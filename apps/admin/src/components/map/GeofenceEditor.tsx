'use client';

import React, { useState } from 'react';
import { CreateWorksiteInput, WorksiteType } from '@employee-tracking/contracts';
import { createWorksite } from '../../lib/api-client';
import { MapPin, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

interface GeofenceEditorProps {
  organizationId: string;
  onWorksiteCreated: () => void;
}

export function GeofenceEditor({ organizationId, onWorksiteCreated }: GeofenceEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [worksiteType, setWorksiteType] = useState<WorksiteType>('CIRCULAR');
  const [latitude, setLatitude] = useState('12.9857');
  const [longitude, setLongitude] = useState('77.5979');
  const [radiusMeters, setRadiusMeters] = useState('50');
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState('120');
  const [polygonJson, setPolygonJson] = useState(
    '[[[77.5975, 12.9855], [77.5985, 12.9855], [77.5985, 12.9860], [77.5975, 12.9860], [77.5975, 12.9855]]]',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radius = parseInt(radiusMeters, 10);
      const grace = parseInt(gracePeriodSeconds, 10);

      if (isNaN(lat) || isNaN(lng) || isNaN(radius) || isNaN(grace)) {
        throw new Error('Please enter valid numeric values for coordinates, radius, and grace period');
      }

      let parsedCoords: any = undefined;
      if (worksiteType === 'POLYGON') {
        try {
          parsedCoords = JSON.parse(polygonJson);
        } catch {
          throw new Error('Invalid JSON format for polygon coordinates');
        }
      }

      const input: CreateWorksiteInput = {
        organizationId,
        name: name.trim(),
        worksiteType,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        gracePeriodSeconds: grace,
        polygonCoordinates: parsedCoords,
      };

      await createWorksite(input);
      setSuccessMessage(`Worksite "${name}" created successfully!`);
      setName('');
      onWorksiteCreated();
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create worksite');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Geofenced Worksite
      </button>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-sm text-slate-900">Define New Worksite Geofence</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Worksite Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Headquarters Facility, Depot Alpha"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Geofence Geometry</label>
            <select
              value={worksiteType}
              onChange={(e) => setWorksiteType(e.target.value as WorksiteType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="CIRCULAR">Circular Boundary</option>
              <option value="POLYGON">Polygon Boundary</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Exit Grace (Seconds)</label>
            <input
              type="number"
              required
              value={gracePeriodSeconds}
              onChange={(e) => setGracePeriodSeconds(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Latitude</label>
            <input
              type="text"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Longitude</label>
            <input
              type="text"
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Radius (Meters)</label>
            <input
              type="number"
              required
              disabled={worksiteType === 'POLYGON'}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        {worksiteType === 'POLYGON' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Polygon Rings (GeoJSON Coordinates Array)
            </label>
            <textarea
              rows={3}
              value={polygonJson}
              onChange={(e) => setPolygonJson(e.target.value)}
              className="w-full font-mono text-[11px] px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Create Worksite'}
          </button>
        </div>
      </form>
    </div>
  );
}
