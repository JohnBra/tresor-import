import { findImplementation } from '@/index';

export function validateAllSamples(implementation, samples, filePrefix) {
  describe('Validate all', () => {
    test('Can the document parsed with 1822direkt', () => {
      samples.forEach(pages => {
        expect(implementation.canParseDocument(pages, 'pdf')).toEqual(true);
      });
    });

    test('Can identify the expected implementation from document', () => {
      samples.forEach((pages, index) => {
        const impl = findImplementation(
          pages,
          `${filePrefix}_${index}.pdf`,
          'pdf'
        );

        expect(impl).toBeDefined();
        expect(impl).toEqual(implementation);
      });
    });
  });
}
