import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { requireAuth } from './middleware/auth';
import routes from './routes';
import { startWeatherJob } from './jobs/weatherJob';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'uploads' directory in the project root
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// Basic Route to test if the API is working
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'PlaySphere API is running successfully!' });
});

// A protected route that only logged-in users can access
app.get('/api/protected', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.status(200).json({
    message: 'Authentication successful!',
    uid: user.uid,
  });
});

// API routes
app.use('/api', routes);

// Start background jobs
startWeatherJob();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
export default app;