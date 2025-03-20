import axios from 'axios';
import { UsersResponse, PostsResponse, CommentsResponse, TopUser, Post, Comment } from '../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class DataService {
  private baseUrl: string;
  private token: string;

  // Cache for efficient data retrieval
  private usersCache: Record<string, string> = {};
  private postsCache: Map<number, Post[]> = new Map();
  private commentsCache: Map<number, Comment[]> = new Map();
  private userPostCountCache: Map<string, number> = new Map();
  private postCommentCountCache: Map<number, number> = new Map();
  private allPostsCache: Post[] = [];
  
  // Last update timestamps for caching strategy
  private lastUsersFetch: number = 0;
  private lastPostsFetch: Map<number, number> = new Map();
  private lastCommentsFetch: Map<number, number> = new Map();

  // Cache TTL in milliseconds (30 seconds for demonstration)
  private cacheTTL: number = 30 * 1000;

  constructor() {
    this.baseUrl = process.env.TEST_SERVER_URL || 'http://20.244.56.144/test';
    this.token = process.env.BEARER_TOKEN || '';
    
    console.log("DataService initialized with:");
    console.log(`- testServerUrl: ${this.baseUrl ? "✓" : "✗"}`);
    console.log(`- bearerToken: ${this.token ? "✓" : "✗"}`);
    
    if (!this.baseUrl || !this.token) {
      console.warn("Warning: TEST_SERVER_URL or BEARER_TOKEN not found in environment variables");
    }
  }

  private async makeAuthorizedRequest<T>(url: string): Promise<T> {
    try {
      const response = await axios.get<T>(url, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw new Error(`Failed to fetch data from ${url}`);
    }
  }

  async getUsers(): Promise<Record<string, string>> {
    const currentTime = Date.now();
    
    // Return cached data if it's still fresh
    if (Object.keys(this.usersCache).length > 0 && currentTime - this.lastUsersFetch < this.cacheTTL) {
      return this.usersCache;
    }

    try {
      const response = await this.makeAuthorizedRequest<UsersResponse>(`${this.baseUrl}/users`);
      this.usersCache = response.users;
      this.lastUsersFetch = currentTime;
      return this.usersCache;
    } catch (error) {
      console.error('Error fetching users:', error);
      // If fetching fails but we have cached data, return it even if stale
      if (Object.keys(this.usersCache).length > 0) {
        return this.usersCache;
      }
      throw new Error('Failed to fetch users');
    }
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    const userIdNum = parseInt(userId, 10);
    const currentTime = Date.now();
    
    // Return cached data if it's still fresh
    if (this.postsCache.has(userIdNum) && 
        this.lastPostsFetch.has(userIdNum) && 
        currentTime - (this.lastPostsFetch.get(userIdNum) || 0) < this.cacheTTL) {
      return this.postsCache.get(userIdNum) || [];
    }

    try {
      const response = await this.makeAuthorizedRequest<PostsResponse>(`${this.baseUrl}/users/${userId}/posts`);
      
      // Add timestamp to each post for sorting by latest
      const postsWithTimestamp = response.posts.map(post => ({
        ...post,
        timestamp: currentTime
      }));
      
      this.postsCache.set(userIdNum, postsWithTimestamp);
      this.lastPostsFetch.set(userIdNum, currentTime);
      
      // Update user post count cache
      this.userPostCountCache.set(userId, postsWithTimestamp.length);
      
      // Update all posts cache
      this.allPostsCache = [...this.allPostsCache.filter(p => p.userid !== userIdNum), ...postsWithTimestamp];
      
      return postsWithTimestamp;
    } catch (error) {
      console.error(`Error fetching posts for user ${userId}:`, error);
      // If fetching fails but we have cached data, return it even if stale
      if (this.postsCache.has(userIdNum)) {
        return this.postsCache.get(userIdNum) || [];
      }
      throw new Error(`Failed to fetch posts for user ${userId}`);
    }
  }

  async getPostComments(postId: number): Promise<Comment[]> {
    const currentTime = Date.now();
    
    // Return cached data if it's still fresh
    if (this.commentsCache.has(postId) && 
        this.lastCommentsFetch.has(postId) && 
        currentTime - (this.lastCommentsFetch.get(postId) || 0) < this.cacheTTL) {
      return this.commentsCache.get(postId) || [];
    }

    try {
      const response = await this.makeAuthorizedRequest<CommentsResponse>(`${this.baseUrl}/posts/${postId}/comments`);
      this.commentsCache.set(postId, response.comments);
      this.lastCommentsFetch.set(postId, currentTime);
      
      // Update post comment count cache
      this.postCommentCountCache.set(postId, response.comments.length);
      
      return response.comments;
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error);
      // If fetching fails but we have cached data, return it even if stale
      if (this.commentsCache.has(postId)) {
        return this.commentsCache.get(postId) || [];
      }
      throw new Error(`Failed to fetch comments for post ${postId}`);
    }
  }

  async getTopUsers(limit: number = 5): Promise<TopUser[]> {
    // Fetch all users first
    const users = await this.getUsers();
    const userIds = Object.keys(users);
    
    // Create a map to store post counts
    const postCounts: Map<string, number> = new Map();
    
    // If we have cached data for post counts, use it
    if (this.userPostCountCache.size > 0) {
      // Fetch any missing user data
      const missingUsers = userIds.filter(id => !this.userPostCountCache.has(id));
      
      // Get post counts for users that we haven't cached yet
      await Promise.all(missingUsers.map(async (userId) => {
        try {
          const posts = await this.getUserPosts(userId);
          postCounts.set(userId, posts.length);
        } catch (error) {
          console.error(`Error getting posts for user ${userId}:`, error);
          postCounts.set(userId, 0);
        }
      }));
      
      // Combine with existing cache
      for (const [userId, count] of this.userPostCountCache.entries()) {
        postCounts.set(userId, count);
      }
    } else {
      // No cache exists, fetch all post counts
      await Promise.all(userIds.map(async (userId) => {
        try {
          const posts = await this.getUserPosts(userId);
          postCounts.set(userId, posts.length);
        } catch (error) {
          console.error(`Error getting posts for user ${userId}:`, error);
          postCounts.set(userId, 0);
        }
      }));
    }
    
    // Sort users by post count and get top N
    const topUsers: TopUser[] = userIds
      .map(id => ({
        id,
        name: users[id],
        postCount: postCounts.get(id) || 0
      }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);
    
    return topUsers;
  }

  async getPopularPosts(): Promise<Post[]> {
    // Fetch all users to get all posts
    const users = await this.getUsers();
    const userIds = Object.keys(users);
    
    // Get posts for all users if not already cached
    if (this.allPostsCache.length === 0) {
      await Promise.all(userIds.map(userId => this.getUserPosts(userId)));
    }
    
    // Get comment counts for all posts
    const postCommentCounts: Map<number, number> = new Map();
    
    // Process posts in batches to avoid too many concurrent requests
    const batchSize = 10;
    const allPosts = [...this.allPostsCache];
    
    // Process in batches
    for (let i = 0; i < allPosts.length; i += batchSize) {
      const batch = allPosts.slice(i, i + batchSize);
      await Promise.all(batch.map(async (post) => {
        try {
          // Use cached comment count if available
          if (this.postCommentCountCache.has(post.id)) {
            postCommentCounts.set(post.id, this.postCommentCountCache.get(post.id) || 0);
          } else {
            const comments = await this.getPostComments(post.id);
            postCommentCounts.set(post.id, comments.length);
          }
        } catch (error) {
          console.error(`Error getting comments for post ${post.id}:`, error);
          postCommentCounts.set(post.id, 0);
        }
      }));
    }
    
    // Find the maximum comment count
    let maxCommentCount = 0;
    for (const count of postCommentCounts.values()) {
      if (count > maxCommentCount) {
        maxCommentCount = count;
      }
    }
    
    // Filter posts with the maximum comment count
    const popularPosts = this.allPostsCache.filter(post => 
      postCommentCounts.get(post.id) === maxCommentCount
    );
    
    return popularPosts;
  }

  async getLatestPosts(limit: number = 5): Promise<Post[]> {
    // Fetch all users to get all posts
    const users = await this.getUsers();
    const userIds = Object.keys(users);
    
    // Get posts for all users if we don't have them cached
    if (this.allPostsCache.length === 0) {
      await Promise.all(userIds.map(userId => this.getUserPosts(userId)));
    }
    
    // Sort by timestamp (newest first) and get top N
    const latestPosts = [...this.allPostsCache]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
    
    return latestPosts;
  }

  async updateCache() {
    try {
      // Make sure we have the necessary configuration
      if (!this.baseUrl) {
        console.error("Cannot update cache: TEST_SERVER_URL is not defined");
        return;
      }

      // Construct the full URL
      const usersUrl = `${this.baseUrl}/users`;
      console.log(`Fetching users from: ${usersUrl}`);
      
      const usersResponse = await axios.get(usersUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      // Process users data
      // ...
      
      const postsUrl = `${this.baseUrl}/posts`;
      console.log(`Fetching posts from: ${postsUrl}`);
      
      const postsResponse = await axios.get(postsUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      // Process posts data
      // ...
      
      console.log("Cache updated successfully");
    } catch (error) {
      console.error("Error updating cache:", error);
    }
  }
}

export default new DataService();