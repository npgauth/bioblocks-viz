import * as NGL from 'ngl';

import {
  BioblocksPDB,
  CONTACT_DISTANCE_PROXIMITY,
  CouplingContainer,
  IContactMapData,
  ISecondaryStructureData,
  ISpringCategoricalColorData,
  ISpringCategoricalColorDataInput,
  ISpringGraphData,
  ISpringNode,
  SECONDARY_STRUCTURE_CODES,
  VIZ_TYPE,
} from '~bioblocks-viz~/data';
import {
  fetchCSVFile,
  fetchJSONFile,
  generateResidueMapping,
  getCouplingHeaderIndices,
  IResidueMapping,
  readFileAsText,
} from '~bioblocks-viz~/helper';

export const fetchAppropriateData = async (viz: VIZ_TYPE, dataDir: string) => {
  switch (viz) {
    case VIZ_TYPE['T-SNE']:
      return fetchTSneCoordinateData(dataDir);
    case VIZ_TYPE['TENSOR-T-SNE']:
      return fetchTensorTSneCoordinateData(dataDir);
    case VIZ_TYPE.SPRING:
      return fetchSpringData(dataDir);
    case VIZ_TYPE.NGL:
      return fetchNGLDataFromDirectory(dataDir);
    case VIZ_TYPE.CONTACT_MAP:
    case VIZ_TYPE.INFO_PANEL:
      return fetchContactMapData(dataDir);
    default:
      return Promise.reject({ error: `Currently no appropriate data getter for ${viz}` });
  }
};

export const fetchAppropriateDataFromFile = async (viz: VIZ_TYPE, file: File) => {
  switch (viz) {
    case VIZ_TYPE.NGL:
      return fetchNGLDataFromFile(file);
    case VIZ_TYPE.CONTACT_MAP:
      return { couplingScores: getCouplingScoresData(await readFileAsText(file)) };
    default:
      return Promise.reject({ error: `Currently no appropriate data getter for ${viz} files` });
  }
};

export const fetchSpringData = async (dataDir: string): Promise<ISpringGraphData> => {
  const catColorData = await fetchCategoricalColorData(`${dataDir}/categorical_coloring_data.json`);

  const nodes = new Array<ISpringNode>();
  const categories = Object.keys(catColorData);

  catColorData[categories[0]].label_list.forEach((label, index) => {
    nodes.push({
      labelForCategory: categories.reduce(
        (prev, category) => ({ ...prev, [category]: catColorData[category].label_list[index] }),
        {},
      ),
      number: index,
    });
  });

  return { nodes };
};

const fetchCategoricalColorData = async (file: string): Promise<{ [key: string]: ISpringCategoricalColorData }> => {
  const input = (await fetchJSONFile(file)) as ISpringCategoricalColorDataInput;
  const result: { [key: string]: ISpringCategoricalColorData } = {};
  for (const key of Object.keys(input)) {
    const colorData = input[key];
    if (!colorData.label_colors || !colorData.label_list) {
      throw new Error("Unable to parse color data - does it have keys named 'label_colors' and 'label_list'");
    }
    const output: ISpringCategoricalColorData = {
      label_colors: {},
      label_list: colorData.label_list,
    };

    const { label_colors } = input[Object.keys(input)[0]];

    // The input file might specify hex values as either 0xrrggbb or #rrggbb, so we need to convert the input to a consistent output format.
    for (const labelColorKey of Object.keys(label_colors)) {
      const hex = label_colors[labelColorKey];
      if (typeof hex === 'number') {
        output.label_colors[labelColorKey] = hex;
      } else if (hex.charAt(0) === '#') {
        output.label_colors[labelColorKey] = Number.parseInt(`0x${hex.slice(1)}`, 16);
      } else {
        output.label_colors[labelColorKey] = Number.parseInt(hex, 16);
      }
    }

    result[key] = output;
  }

  return result;
};

export const fetchSpringCoordinateData = async (file: string) => {
  const coordinateText: string = await fetchCSVFile(file);

  const coordinates: number[][] = [];
  const rows = coordinateText ? coordinateText.split('\n') : [];
  rows.forEach((entry, index, array) => {
    const items = entry.split(',');
    if (items.length >= 3) {
      const xx = parseFloat(items[1].trim());
      const yy = parseFloat(items[2].trim());
      const nn = parseInt(items[0].trim(), 10);
      coordinates[nn] = [xx, yy];
    } else if (entry.localeCompare('') !== 0) {
      throw new Error(`Unable to parse coordinate data - Row ${index} does not have at least 3 columns!`);
    }
  });

  return coordinates;
};

export const fetchTSneCoordinateData = async (dataDir: string) => {
  const coordText: string = await fetchCSVFile(`${dataDir}/tsne_output.csv`);
  const result: number[][] = [];
  coordText.split('\n').forEach(entry => {
    if (entry.length > 0) {
      const items = entry.split(',');
      const coordinates = [parseFloat(items[0]), parseFloat(items[1])];
      result.push(coordinates);
    }
  });

  return result;
};

export const fetchTensorTSneCoordinateDataFromFile = async (fileLocation: string) => {
  const coordText: string = await fetchCSVFile(fileLocation);
  const matrix = new Array<number[]>();
  for (const row of coordText.split('\n')) {
    if (row.length >= 1) {
      matrix.push(row.split(',').map(parseFloat));
    }
  }

  return matrix;
};

export const fetchTensorTSneCoordinateData = async (dataDir: string) => {
  return fetchTensorTSneCoordinateDataFromFile(`${dataDir}/tsne_matrix.csv`);
};

export const fetchGraphData = async (file: string) => {
  const data = (await fetchJSONFile(file)) as ISpringGraphData;
  if (!data.nodes || !data.links) {
    throw new Error("Unable to parse graph data - does it have keys named 'nodes' and 'links'");
  }

  return data;
};

export const fetchNGLDataFromDirectory = async (dir: string) => {
  if (dir.length === 0) {
    return Promise.reject('Empty path.');
  }
  const file = `${dir}/protein.pdb`;

  return fetchNGLDataFromFile(file);
};

export const fetchNGLDataFromFile = async (file: string | File | Blob, params: Partial<NGL.ILoaderParameters> = {}) =>
  (await NGL.autoLoad(file, params)) as NGL.Structure;

export const fetchContactMapData = async (
  dir: string,
  knownOrPredicted: 'known' | 'predicted' = 'known',
): Promise<IContactMapData> => {
  if (dir.length === 0) {
    return Promise.reject('Empty path.');
  }
  const contactMapFiles = ['coupling_scores.csv', 'residue_mapping.csv'];
  const promiseResults = await Promise.all(contactMapFiles.map(async file => fetchCSVFile(`${dir}/${file}`)));
  const pdbFile = await BioblocksPDB.createPDB(`${dir}/protein.pdb`);
  const pdbData = {
    [knownOrPredicted]: pdbFile,
  };

  return {
    couplingScores: pdbFile.amendPDBWithCouplingScores(
      getCouplingScoresData(promiseResults[0], generateResidueMapping(promiseResults[1])).rankedContacts,
      CONTACT_DISTANCE_PROXIMITY.CLOSEST,
    ),
    pdbData,
    secondaryStructures: [],
  };
};

/**
 * Parses a coupling_scores.csv file to generate the appropriate data structure.
 *
 * !Important!
 * Currently 12 fields are assumed to be part of a single coupling score.
 * As such, any rows with less will be ignored.
 *
 * @param line The csv file as a single string.
 * @param residueMapping Maps the coupling_score.csv residue number to the residue number for the PDB.
 * @returns Array of CouplingScores suitable for bioblocks-viz consumption.
 */
export const getCouplingScoresData = (line: string, residueMapping: IResidueMapping[] = []): CouplingContainer => {
  const headerRow = line.split('\n')[0].split(',');
  const isHeaderPresent = isCouplingHeaderPresent(headerRow);
  const headerIndices = getCouplingHeaderIndices(headerRow, isHeaderPresent);
  const couplingScores = new CouplingContainer();
  line
    .split('\n')
    .slice(isHeaderPresent ? 1 : 0)
    .filter(row => row.split(',').length >= 2)
    .map(row => {
      const items = row.split(',');
      const score = getCouplingScoreFromCSVRow(items, headerIndices);
      if (residueMapping.length >= 1) {
        const mappingIndexI = residueMapping.findIndex(mapping => mapping.couplingsResno === score.i);
        const mappingIndexJ = residueMapping.findIndex(mapping => mapping.couplingsResno === score.j);
        couplingScores.addCouplingScore({
          ...score,
          A_i: residueMapping[mappingIndexI].pdbResCode,
          A_j: residueMapping[mappingIndexJ].pdbResCode,
          i: residueMapping[mappingIndexI].pdbResno,
          j: residueMapping[mappingIndexJ].pdbResno,
        });
      } else {
        couplingScores.addCouplingScore(score);
      }
    });

  return couplingScores;
};

const isCouplingHeaderPresent = (headerRow: string[]) =>
  ['cn', 'dist', 'i', 'j'].filter(row => headerRow.includes(row)).length >= 1;

const getCouplingScoreFromCSVRow = (row: string[], headerIndices: { [key: string]: number }) =>
  Object.entries(headerIndices).reduce(
    (prev, headerName) => {
      const couplingKey = headerName[0];
      const couplingKeyIndex = headerName[1];

      return {
        ...prev,
        [couplingKey]: isNaN(Number(row[couplingKeyIndex])) ? row[couplingKeyIndex] : Number(row[couplingKeyIndex]),
      };
    },
    { i: -1, j: -1 },
  );

export const augmentCouplingScoresWithResidueMapping = (
  couplingScores: CouplingContainer,
  residueMapping: IResidueMapping[] = [],
): CouplingContainer => {
  const result = new CouplingContainer();
  for (const couplingScore of couplingScores) {
    const mappedIndexI = residueMapping.findIndex(mapping => mapping.couplingsResno === couplingScore.i);
    const mappedIndexJ = residueMapping.findIndex(mapping => mapping.couplingsResno === couplingScore.j);

    result.addCouplingScore({
      A_i: residueMapping[mappedIndexI].pdbResCode,
      A_j: residueMapping[mappedIndexJ].pdbResCode,
      cn: couplingScore.cn,
      dist: couplingScore.dist,
      i: residueMapping[mappedIndexI].pdbResno,
      j: residueMapping[mappedIndexJ].pdbResno,
    });
  }

  return result;
};

/**
 * Parses a distance_map.csv file to generate the appropriate secondary structure mapping.
 *
 * !Important!
 * The first line in the csv will be ignored as it is assumed to be a csv header.
 *
 * !Important!
 * Currently 3 fields are assumed to be part of a single entry, with the second and third actually being relevant.
 * As such, any other rows will be ignored.
 *
 * @param line The csv file as a single string.
 * @returns Array of SecondaryStructure mappings suitable for bioblocks-viz consumption.
 */
export const getSecondaryStructureData = (line: string): ISecondaryStructureData[] => {
  return line
    .split('\n')
    .slice(1)
    .filter(row => row.split(',').length >= 3)
    .map(row => {
      const items = row.split(',');

      return {
        resno: parseFloat(items[1]),
        structId: items[2] as keyof typeof SECONDARY_STRUCTURE_CODES,
      };
    });
};

/*
TODO Currently not being used by Spring. Remove? Use in future Spring work?
export const fetchColorData = async (file: string) => {
  const colorText: string = await fetchCSVFile(file);
  const dict: { [k: string]: any } = {};
  colorText.split('\n').forEach((entry, index, array) => {
    if (entry.length > 0) {
      const items = entry.split(',');
      const gene = items[0];
      const expArray: any[] = [];
      items.forEach((e, i, a) => {
        if (i > 0) {
          expArray.push(parseFloat(e));
        }
      });
      dict[gene] = expArray;
    }
  });
  return dict;
};
*/
