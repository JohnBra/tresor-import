import { csvLinesToJSON } from '@/helper';
import pdfjs from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import * as brokers from './brokers';
import * as apps from './apps';
import { isBrowser, isNode } from 'browser-or-node';
import { ParqetError, ParqetDocumentError } from '@/errors';

export const acceptedFileTypes = ['pdf', 'csv'];

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** @type { Importer.Implementation[] } */
export const allImplementations = [
  ...Object.values(brokers),
  ...Object.values(apps),
];

/** @type { (pages: Importer.Page[], extension: string) => Importer.Implementation[] | undefined} */
export const findImplementation = (pages, extension) => {
/**
 * @param {Importer.page[]} pages
 * @param {string} fileName
 * @param {string} extension
 * @returns {Importer.Implementation}
 */
export function findImplementation(pages, fileName, extension) {
  if (!acceptedFileTypes.includes(extension.toLowerCase()))
    throw new ParqetDocumentError(
      `Invalid document. Unsupported file type '${extension}'. Extension must be one of [${acceptedFileTypes.join(
        ','
      )}].`,
      fileName,
      4
    );

  // The broker or app will be selected by the content of the first page
  const implementations = allImplementations.filter(impl =>
    impl.canParseDocument(pages, extension)
  );

  if (implementations === undefined || !implementations.length)
    throw new ParqetDocumentError(
      `Invalid document. Failed to find parser implementation for document.`,
      fileName,
      1
    );

  if (implementations.length > 1)
    throw new ParqetDocumentError(
      `Invalid document. Found multiple parser implementations for document.`,
      fileName,
      2
    );

  return implementations[0];
}

/**
 * @param {Importer.page[]} pages
 * @param {string} fileName
 * @param {string} extension
 * @returns {Importer.Activity[]}
 */
export function parseActivitiesFromPages(pages, fileName, extension) {
  if (!pages.length)
    throw new ParqetDocumentError(
      `Invalid document. Document is empty.`,
      fileName,
      1
    );

  const impl = findImplementation(pages, fileName, extension);

  let activities = [];

  if (extension === 'pdf') {
    activities = filterResultActivities(impl.parsePages(pages));
  } else if (extension === 'csv') {
    activities = filterResultActivities(
      impl.parsePages(JSON.parse(csvLinesToJSON(pages[0])))
    );
  }

  return activities;
}

/** @type { (file: File) => Promise<Importer.ParsedFile> } */
export const parseFile = file => {
  return new Promise(resolve => {
    const extension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = async e => {
      if (!isBrowser || isNode) {
        resolve({
          pages: [],
          extension,
        });
      }

      let fileContent, pdfDocument;
      /** @type {Importer.Page[]} */
      let pages = [];

      if (extension === 'pdf') {
        if (typeof e.target.result === 'string') {
          throw Error('Expected ArrayBuffer - got string');
        }

        fileContent = new Uint8Array(e.target.result);
        /** @type {pdfjs.PDFDocumentProxy} */
        pdfDocument = await pdfjs.getDocument(fileContent).promise;

        const loopHelper = Array.from(Array(pdfDocument.numPages)).entries();
        for (const [pageIndex] of loopHelper) {
          const parsedContent = await parsePageToContent(
            await pdfDocument.getPage(pageIndex + 1)
          );
          pages.push(parsedContent);
        }
      } else {
        if (typeof e.target.result !== 'string') {
          throw Error('Expected target to be a string');
        }

        pages.push(e.target.result.trim().split('\n'));
      }

      resolve({
        pages,
        extension,
      });
    };

    if (extension === 'pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
};

export default file => {
  return new Promise(resolve => {
    try {
      parseFile(file).then(parsedFile => {
        const activities = parseActivitiesFromPages(
          parsedFile.pages,
          file.name,
          parsedFile.extension
        );

        resolve({
          file: file.name,
          activities,
          status: 0,
          successful: !!activities.length,
        });
      });
    } catch (error) {
      if (error instanceof ParqetError) {
        resolve({
          file: file.name,
          activities: [],
          status: error.data.status,
          successful: false,
        });
      }
    }
  });
};

const filterResultActivities = result => {
  if (result.activities !== undefined) {
    if (
      result.activities.filter(activity => activity === undefined).length > 0
    ) {
      // One or more activities are invalid and can't be validated with the validateActivity function. We should ignore this document and return the specific status code.
      result.activities = undefined;
      result.status = 6;

      return result;
    }

    // If no activity exists, set the status code to 5
    const numberOfActivities = result.activities.length;
    result.activities =
      numberOfActivities === 0 ? undefined : result.activities;
    result.status =
      numberOfActivities === 0 && result.status === 0 ? 5 : result.status;
  }

  return result;
};

/**
 * @param {pdfjs.PDFPageProxy} page
 * @returns {Promise<string[]>}
 */
async function parsePageToContent(page) {
  const parsedContent = [];
  const content = await page.getTextContent();

  for (const currentContent of content.items) {
    parsedContent.push(currentContent.str.trim());
  }

  return parsedContent.filter(item => item.length > 0);
}
