/**
 * Legacy ImageGallery wrapper - re-exports from gallery/
 * 
 * This file is kept for backwards compatibility.
 * New code should import from './gallery' directly.
 * 
 * The ImageGallery has been refactored into smaller components:
 * 
 * src/components/gallery/
 * ├── types.ts              - Type definitions
 * ├── hooks/
 * │   ├── useGalleryImages.ts   - Image fetching logic
 * │   ├── useFavorites.ts       - Favorites management
 * │   ├── useImageMetadata.ts   - PNG metadata extraction
 * │   └── useImageActions.ts    - Delete, copy, download
 * ├── GalleryHeader.tsx     - Header with filters/controls
 * ├── ImageCard.tsx         - Individual image thumbnail
 * ├── Lightbox.tsx          - Full-screen image viewer
 * ├── MetadataPanel.tsx     - PNG metadata display
 * ├── DeleteConfirmDialog.tsx - Delete confirmation
 * ├── EmptyState.tsx        - Empty/error states
 * └── ImageGallery.tsx      - Main component (~230 lines)
 * 
 * Total: ~200 lines per file instead of 992 lines
 */

export { ImageGallery } from './gallery';
export type { ImageInfo, ImageMetadata, GridSize, FilterMode } from './gallery';

// Keep old default export for compatibility
import { ImageGallery as Gallery } from './gallery';
export default Gallery;
