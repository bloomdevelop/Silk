import E621 from "e621";
import type { Options } from "e621";
export class E621APIHandler extends E621 {

    constructor(options?: Options) {
        super(options);   
    }

    public async getRandomPost(
        tags: string,
        limitQuery: number
    ) {
        try {
            const post = this.posts
                .search({
                    limit: limitQuery,
                    // Tags are passed manually as we don't need to append anything
                    tags,
                })
                .then(
                    (posts) =>
                        // Get a random post in the uglyest way possible
                        posts[
                            Math.floor(
                                Math.random() *
                                    (Math.floor(posts.length) -
                                        Math.ceil(0))
                            ) + Math.ceil(0)
                        ]
                );
            return Promise.resolve(post);
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
