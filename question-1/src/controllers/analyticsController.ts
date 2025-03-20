import { Request, Response } from 'express';
import dataService from '../services/dataService';

export const getTopUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const topUsers = await dataService.getTopUsers(limit);
    
    res.status(200).json({ users: topUsers });
  } catch (error) {
    console.error('Error in getTopUsers controller:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
};

export const getPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = req.query.type as string || 'latest';
    
    if (type === 'popular') {
      const popularPosts = await dataService.getPopularPosts();
      res.status(200).json({ posts: popularPosts });
    } else if (type === 'latest') {
      const latestPosts = await dataService.getLatestPosts();
      res.status(200).json({ posts: latestPosts });
    } else {
      res.status(400).json({ error: 'Invalid post type. Use "popular" or "latest".' });
    }
  } catch (error) {
    console.error('Error in getPosts controller:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};