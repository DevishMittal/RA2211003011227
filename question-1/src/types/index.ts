//Here we are defining user and post data structures that will be used.

export interface User {
    userId: string;
    name: string;
    postCount: number;
  }
  
  export interface Post {
    postId: number;
    userId: string;
    content: string;
    commentCount: number;
    fetchTimestamp: number;
    userName?: string;
  }