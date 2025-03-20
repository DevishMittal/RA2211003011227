import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { getTopUsers, getPosts } from './controllers/analyticsController';
import dataService from "./services/dataService"

// Load environment variables
dotenv.config();

// Check environment variables
if (!process.env.TEST_SERVER_URL) {
  console.warn("Warning: TEST_SERVER_URL not found in environment variables");
}
if (!process.env.BEARER_TOKEN) {
  console.warn("Warning: BEARER_TOKEN not found in environment variables");
}

// Initialize express app
const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3001', 10);

// Setup rate limiter to avoid excessive requests
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
app.get('/users', getTopUsers);
app.get('/posts', getPosts);

// Start the server and initialize cache
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Initialize data cache on startup
  dataService.updateCache()
    .then(() => console.log("Initial cache update completed"))
    .catch(err => console.error("Failed to initialize cache:", err));
});

export default app;