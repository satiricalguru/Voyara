import { Router } from 'express';
import * as c from '../controllers/search.controller.js';

const r = Router();
r.get('/', c.search);
r.get('/suggest', c.suggest);
export default r;
