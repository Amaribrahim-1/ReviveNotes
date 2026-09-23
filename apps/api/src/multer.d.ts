declare module "multer" {
  import type { RequestHandler } from "express";

  interface StorageEngine {
    _engine: string;
  }

  interface Options {
    storage?: StorageEngine;
    limits?: {
      fileSize?: number;
      files?: number;
    };
  }

  interface Multer {
    single(fieldName: string): RequestHandler;
  }

  interface MulterError extends Error {
    code: string;
  }

  interface MulterFactory {
    (options?: Options): Multer;
    memoryStorage(): StorageEngine;
    MulterError: new (code: string, field?: string) => MulterError;
  }

  const multer: MulterFactory;
  export default multer;
}
