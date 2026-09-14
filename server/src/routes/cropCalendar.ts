// ============================================================
// Crop Calendar Router — Express Endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import {
  getCropCalendar,
  getCropDetails,
  getAvailableStates,
  getStateCrops,
  normalizeState,
} from '../services/cropCalendarService';

export const cropCalendarRouter = Router();

// GET /api/crop-calendar?state=Rajasthan&month=9&crop=Wheat&phase=sowing
cropCalendarRouter.get('/', async (req: Request, res: Response) => {
  try {
    const state = String(req.query.state || 'Rajasthan');
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const crop = req.query.crop ? String(req.query.crop) : null;
    const phase = req.query.phase ? (String(req.query.phase) as any) : 'all';

    const result = await getCropCalendar({ state, month, crop, phase });
    res.json(result);
  } catch (err: any) {
    console.error('[CropCalendarRoute] Error:', err);
    res.status(500).json({
      success: false,
      error: 'Crop calendar information is temporarily unavailable. Please try again.',
    });
  }
});

// POST /api/crop-calendar (convenience for tool calls or JSON body)
cropCalendarRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { state = 'Rajasthan', month = new Date().getMonth() + 1, crop = null, phase = 'all' } = req.body;
    const result = await getCropCalendar({ state, month: Number(month), crop, phase });
    res.json(result);
  } catch (err: any) {
    console.error('[CropCalendarRoute] POST error:', err);
    res.status(500).json({
      success: false,
      error: 'Crop calendar information is temporarily unavailable. Please try again.',
    });
  }
});

// GET /api/crop-calendar/states
cropCalendarRouter.get('/states', (_req: Request, res: Response) => {
  try {
    const states = getAvailableStates();
    res.json({ success: true, states });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get states' });
  }
});

// GET /api/crop-calendar/crops?state=Rajasthan
cropCalendarRouter.get('/crops', (req: Request, res: Response) => {
  try {
    const state = String(req.query.state || 'Rajasthan');
    const crops = getStateCrops(state);
    res.json({ success: true, crops });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get crops' });
  }
});

// GET /api/crop-calendar/crop-details?state=Rajasthan&crop=Wheat
cropCalendarRouter.get('/crop-details', (req: Request, res: Response) => {
  try {
    const state = String(req.query.state || 'Rajasthan');
    const crop = String(req.query.crop || '');

    if (!crop) {
      return res.status(400).json({ success: false, error: 'Crop name is required.' });
    }

    const details = getCropDetails(state, crop);
    if (!details) {
      return res.status(404).json({
        success: false,
        error: `Crop details not found for "${crop}" in ${normalizeState(state)}.`,
      });
    }

    res.json({ success: true, details });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get crop details' });
  }
});
