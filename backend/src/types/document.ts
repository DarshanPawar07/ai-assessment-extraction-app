export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentPage {
  pageNumber: number;

  /**
   * Width of the page/image in pixels.
   */
  width: number;

  /**
   * Height of the page/image in pixels.
   */
  height: number;

  /**
   * Local path to the normalized/rendered page image.
   */
  imagePath?: string;
}

export interface DocumentFile {
  id: string;

  originalName: string;

  mimeType: string;

  path: string;

  pageCount: number;

  pages: DocumentPage[];
}