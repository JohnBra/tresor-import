class ParqetError extends Error {
  constructor(message) {
    super(message);
  }
}


export class ParqetDocumentError extends ParqetError {
  /**
   * Covers status codes 1, 2, 4 and 7 (implementation errors/unknown documents/unknown extensions/ignored documents)
   *
   * @param {string} message - error message
   * @param {string} fileName - file name incl. extension causing the document error
   * @param {number} status - Parqet error code
   */
  constructor(message, fileName, status) {
    super(`${message}\nFile: ${fileName}`);
    this.name = this.constructor.name;
    this.data = { status };
  }
}


export class ParqetParserError extends ParqetError {
  /**
   * Covers status code 3 (+ any errors during parsing values from PDFs/CSVs, etc.)
   *
   * @param {string} message - error message
   * @param {string} input - value causing the parsing error
   * @param {number} status - Parqet error code
   */
  constructor(message, input, status) {
    super(`${message}\nInput: ${input}`);
    this.name = this.constructor.name;
    this.data = { status };
  }
}

//
export class ParqetActivityValidationError extends ParqetError {
  /**
   * Covers status code 5 and 6 (+ any errors related to missing values/invalid values, etc.)
   *
   * @param {string} message - error message
   * @param {Importer.Activity | Partial<Importer.Activity>} activity - activity causing the validation error
   * @param {number} status - Parqet error code
   */
  constructor(message, activity, status) {
    super(`${message}\nActivity: ${
      JSON.stringify(
        activity, 
        (k, v) => v === undefined ? '>>>  undefined  <<<' : v, 
        2
      )
    }`);
    this.name = this.constructor.name;
    this.data = { status };
  }
}
