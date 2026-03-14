/**
 * Download an image by fetching it as a blob first.
 * This bypasses cross-origin restrictions that prevent the
 * `<a download>` attribute from working on external URLs.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed, opening in new tab:', error);
        window.open(url, '_blank');
    }
}

/**
 * Download multiple images sequentially with a delay
 * to prevent browser from blocking rapid downloads.
 */
export async function downloadAll(urls: string[]): Promise<void> {
    for (let i = 0; i < urls.length; i++) {
        const filename = `visora-design-${i + 1}-${Date.now()}.png`;
        await downloadImage(urls[i], filename);
        // 500ms delay between downloads to avoid browser blocking
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}
