import express from 'express';
import cors from 'cors';
import path from 'path';
import { logger } from '../utils/logger';
import { ChoreService } from './ChoreService';
import { GarbageService } from './GarbageService';

export class WebServer {
    private app: express.Express;
    private port: number = 8099;

    constructor(
        private choreService: ChoreService,
        private garbageService: GarbageService
    ) {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        // Serve static files from the 'public' directory
        this.app.use(express.static(path.join(process.cwd(), 'public')));
    }

    private setupRoutes() {
        // API Routes
        this.app.get('/api/chores', (_req, res) => {
            try {
                const chores = this.choreService.getAllChoresWithStatus();
                return res.json(chores);
            } catch (error) {
                logger.error(`Error fetching chores: ${error}`);
                return res.status(500).json({ error: 'Failed to fetch chores' });
            }
        });

        this.app.get('/api/chores/:id/stats', (req, res) => {
            logger.info(`Hit stats route for ID: ${req.params.id}`);
            try {
                const id = parseInt(req.params.id, 10);
                if (isNaN(id)) {
                    return res.status(400).json({ error: 'Invalid ID' });
                }
                const stats = this.choreService.getChoreStats(id);
                return res.json(stats);
            } catch (error) {
                logger.error(`Error fetching chore stats: ${error}`);
                return res.status(500).json({ error: 'Failed to fetch chore stats' });
            }
        });

        this.app.get('/api/garbage', (_req, res) => {
            try {
                const schedule = this.garbageService.getAll();
                return res.json(schedule);
            } catch (error) {
                logger.error(`Error fetching garbage schedule: ${error}`);
                return res.status(500).json({ error: 'Failed to fetch garbage schedule' });
            }
        });

        this.app.post('/api/garbage', (req, res) => {
            try {
                const { date, type, description } = req.body;
                if (!date || !type) {
                    return res.status(400).json({ error: 'Date and type are required' });
                }
                const entry = this.garbageService.add(date, type, description);
                return res.status(201).json(entry);
            } catch (error) {
                logger.error(`Error adding garbage schedule entry: ${error}`);
                return res.status(500).json({ error: 'Failed to add entry' });
            }
        });

        this.app.delete('/api/garbage/:id', (req, res) => {
            try {
                const id = parseInt(req.params.id, 10);
                if (isNaN(id)) {
                    return res.status(400).json({ error: 'Invalid ID' });
                }
                const success = this.garbageService.remove(id);
                if (success) {
                    return res.status(204).send();
                } else {
                    return res.status(404).json({ error: 'Entry not found' });
                }
            } catch (error) {
                logger.error(`Error removing garbage schedule entry: ${error}`);
                return res.status(500).json({ error: 'Failed to remove entry' });
            }
        });

        // Fallback for SPA (if we had client-side routing, but here we just serve index.html)
        // Fallback for SPA
        this.app.get(/.*/, (req, res) => {
            logger.info(`Fallback route hit for: ${req.path}`);
            return res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
        });
    }

    public start() {
        logger.info(`Starting web server on port ${this.port}`);
        this.app.listen(this.port, (err) => {
            if (err) {
                logger.error(`Failed to start web server: ${err}`);
                return;
            }
            logger.info(`Web server running on port ${this.port}`);
        });
    }
}
