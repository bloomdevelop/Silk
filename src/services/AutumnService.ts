import { Logger } from '../utils/Logger.js';

interface AutumnResponse {
    id: string;
}

const logger = Logger.getInstance('Autumn');
const BASE_URL =
    process.env.AUTUMN_URL || 'https://autumn.revolt.chat';

/**
 * Upload a Blob or Buffer to Autumn
 * @param tag - Bucket name (e.g., 'attachments', 'avatars')
 * @param file - File or File contents as Blob/Buffer
 * @param filename - Optional filename (defaults to 'file')
 * @returns Promise<string> - The ID of the uploaded file
 */
export async function uploadFile(
    tag: string,
    file: Blob | Buffer,
    filename = 'file',
): Promise<string> {
    const formData = new FormData();

    // Handle both Blob and Buffer inputs
    if (file instanceof Buffer) {
        formData.append('file', new Blob([new Uint8Array(file)], { type: 'application/octet-stream' }), filename);
    } else {
        formData.append('file', file as Blob, filename);
    }

    logger.debug('Uploading file to Autumn', {
        tag,
        filename,
        size: file instanceof Blob ? file.size : file.length,
    });

    try {
        const response = await fetch(`${BASE_URL}/${tag}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(
                `Failed to upload file: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as AutumnResponse;
        logger.debug('File uploaded successfully', { id: data.id });
        return data.id;
    } catch (error) {
        logger.error('Error uploading file:', error);
        throw error;
    }
}

/**
 * Get the URL for an uploaded file
 * @param tag - Bucket name
 * @param id - File ID
 * @returns The full URL to the file
 */
export function getFileUrl(tag: string, id: string): string {
    return `${BASE_URL}/${tag}/${id}`;
}

/**
 * Upload a file from a URL to Autumn
 * @param tag - Bucket name
 * @param url - URL of the file to upload
 * @returns Promise<string> - The ID of the uploaded file
 */
export async function uploadFromUrl(
    tag: string,
    url: string,
): Promise<string> {
    try {
        logger.debug('Fetching file from URL', { url });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch file: ${response.status} ${response.statusText}`,
            );
        }

        const blob = await response.blob();
        return uploadFile(tag, blob);
    } catch (error) {
        logger.error('Error uploading from URL:', error);
        throw error;
    }
}
