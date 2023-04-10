import E621 from "e621";
import type { Options, Post } from "e621";
export class E621APIHandler extends E621 {
    constructor(options?: Options) {
        super(options);
    }
    /**
     * Gets a random post
     * @param tags E621 Formated Tags
     * @param limitQuery Maximum ammount of posts
     * @param nsfw Allow NSFW Results, Default is false
     * @example ## Usage
     * ```ts
     * const api = new E621APIHandler();
     *
     * const post = await api.getRandomPost("rating:safe xenia_(linux)", 100);
     *
     * // Get the post's image url
     * console.log(post.file.url);
     * ```
     * @returns @type Post
     */
    public async getRandomPost(
        tags: string,
        limitQuery: number,
        nsfw?: boolean
    ): Promise<Post> {
        try {
            const post = this.posts
                .search({
                    limit: limitQuery,
                    // Tags are passed manually as we don't need to append anything
                    tags,
                })
                .then(
                    (posts) => {
                        const filtered: Post[] = nsfw
                            ? posts
                            : posts.filter((p) => p.rating === "s");
                        return filtered[
                            Math.floor(
                                Math.random() *
                                    (Math.floor(posts.length) -
                                        Math.ceil(0))
                            ) + Math.ceil(0)
                        ];
                    }
                    // Get a random post in the ugliest way possible
                );
            return Promise.resolve(post);
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
