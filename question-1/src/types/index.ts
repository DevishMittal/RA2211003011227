// Request/Response Types
export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: number;
  userid: number;
  content: string;
  timestamp?: number; // For tracking when we retrieved the post
}

export interface Comment {
  id: number;
  postid: number;
  content: string;
}

export interface TopUser {
  id: string;
  name: string;
  postCount: number;
}

// Response Types from Test Server
export interface UsersResponse {
  users: Record<string, string>;
}

export interface PostsResponse {
  posts: Post[];
}

export interface CommentsResponse {
  comments: Comment[];
}