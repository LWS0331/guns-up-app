import { describe, it, expect } from 'vitest';
import { planWearableReconcile } from '../wearableReconcile';

const prov = (slug: string, status = 'connected', name = slug) => ({ slug, name, status });
const row = (id: string, provider: string, active = true) => ({ id, provider, active });

describe('planWearableReconcile', () => {
  it('creates a row for a connected provider with no local row (the op-ruben recovery case)', () => {
    const plan = planWearableReconcile([prov('oura', 'connected', 'Oura')], []);
    expect(plan.activate).toEqual([{ provider: 'oura', name: 'Oura', existingId: null }]);
    expect(plan.deactivate).toEqual([]);
  });

  it('reactivates an existing inactive row', () => {
    const plan = planWearableReconcile([prov('whoop_v2')], [row('c1', 'whoop_v2', false)]);
    expect(plan.activate).toEqual([{ provider: 'whoop_v2', name: 'whoop_v2', existingId: 'c1' }]);
    expect(plan.deactivate).toEqual([]);
  });

  it('is a no-op when the connected provider already has an active row', () => {
    const plan = planWearableReconcile([prov('oura')], [row('c1', 'oura', true)]);
    expect(plan.activate).toEqual([]);
    expect(plan.deactivate).toEqual([]);
  });

  it('deactivates a local active row no longer connected at Vital', () => {
    const plan = planWearableReconcile([], [row('c1', 'oura', true)]);
    expect(plan.activate).toEqual([]);
    expect(plan.deactivate).toEqual([{ id: 'c1', provider: 'oura' }]);
  });

  it('treats a provider in "error" status as not connected (deactivate)', () => {
    const plan = planWearableReconcile([prov('garmin', 'error')], [row('c1', 'garmin', true)]);
    expect(plan.activate).toEqual([]);
    expect(plan.deactivate).toEqual([{ id: 'c1', provider: 'garmin' }]);
  });

  it('compares slugs case-insensitively (no spurious activate/deactivate)', () => {
    const plan = planWearableReconcile([prov('Oura', 'connected')], [row('c1', 'oura', true)]);
    expect(plan.activate).toEqual([]);
    expect(plan.deactivate).toEqual([]);
  });

  it('handles a mix: activate one, deactivate another, leave a third', () => {
    const plan = planWearableReconcile(
      [prov('oura'), prov('whoop_v2')],
      [row('c1', 'oura', true), row('c2', 'fitbit', true)],
    );
    expect(plan.activate).toEqual([{ provider: 'whoop_v2', name: 'whoop_v2', existingId: null }]);
    expect(plan.deactivate).toEqual([{ id: 'c2', provider: 'fitbit' }]);
  });
});
