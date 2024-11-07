import { Logger } from "../utils/Logger.js";

interface AutumnResponse {
    id: string;
}

export class AutumnService {
    private static logger = Logger.getInstance("Autumn");
    private static readonly BASE_URL = process.env.AUTUMN_URL || "https://autumn.revolt.chat";

    /**
     * Upload a Blob or Buffer to Autumn
     * @param tag - Bucket name (e.g., 'attachments', 'avatars')
     * @param file - File or File contents as Blob/Buffer
     * @param filename - Optional filename (defaults to 'file')
     * @returns Promise<string> - The ID of the uploaded file
     */
    static async uploadFile(
        tag: string,
        file: Blob | Buffer,
        filename: string = "file"
    ): Promise<string> {
        try {
            const formData = new FormData();
            
            // Handle both Blob and Buffer inputs
            if (file instanceof Buffer) {
                formData.append("file", new Blob([file]), filename);
            } else {
                formData.append("file", file, filename);
            }

            this.logger.debug("Uploading file to Autumn", {
                tag,
                filename,
                size: file instanceof Blob ? file.size : file.length
            });

            const response = await fetch(`${this.BASE_URL}/${tag}`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Autumn upload failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as AutumnResponse;
            
            this.logger.debug("File uploaded successfully", { 
                id: data.id,
                tag 
            });

            return data.id;

        } catch (error) {
            this.logger.error("Error uploading file to Autumn:", error);
            throw error;
        }
    }

    /**
     * Get the URL for an uploaded file
     * @param tag - Bucket name
     * @param id - File ID
     * @returns The full URL to the file
     */
    static getFileUrl(tag: string, id: string): string {
        return `${this.BASE_URL}/${tag}/${id}`;
    }

    /**
     * Upload a file from a URL to Autumn
     * @param tag - Bucket name
     * @param url - URL of the file to upload
     * @returns Promise<string> - The ID of the uploaded file
     */
    static async uploadFromUrl(tag: string, url: string): Promise<string> {
        try {
            this.logger.debug("Fetching file from URL", { url });

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            return this.uploadFile(tag, blob);

        } catch (error) {
            this.logger.error("Error uploading from URL:", error);
            throw error;
        }
    }
} 