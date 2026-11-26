import {it,expect} from 'vitest';
import {canonicalLocation,locationSuggestions,normalizeSearchText,primaryJobLocation} from '../src/services/directoryPolicy.js';
it('combines accented state names and separates workplace suffixes',()=>{
  expect(locationSuggestions(['Haryāna','Haryana','Karnataka (Hybrid)','Karnātaka','Karnataka','tamil nadu','Tamil Nadu'])).toEqual(['Haryana','Karnataka','Tamil Nadu']);
  expect(normalizeSearchText('Haryāna')).toBe(normalizeSearchText('Haryana'));
  expect(canonicalLocation('Karnataka (Hybrid)')).toBe('Karnataka');
});
it('deduplicates known city aliases and office variants without collapsing distinct places',()=>{
  expect(locationSuggestions(['Bangalore - WF','Bengaluru Office','IN-Bengaluru','Hybrid in Bengaluru','Gurgaon','Gurugram','Bhubaneshwar','Bhubaneswar','Noida','Greater Noida','Navi Mumbai','Mumbai','Karnataka (Hybrid)'])).toEqual(['Bengaluru','Bhubaneswar','Greater Noida','Gurugram','Karnataka','Mumbai','Navi Mumbai','Noida']);
});

it('keeps working arrangements out of geographic choices',()=>{expect(locationSuggestions(['Remote (India)','India Remote','Remote - India','India','Remote','Hybrid - Bengaluru'])).toEqual(['Bengaluru','India','Remote']);});

it('shows one primary place in original source order, preserving full source data',()=>{expect(primaryJobLocation('Pune / Bengaluru, India')).toBe('Pune');expect(primaryJobLocation('India; Gurugram; Mumbai')).toBe('Gurugram');expect(primaryJobLocation('Bangalore, Karnataka (Hybrid), IN')).toBe('Bengaluru');expect(primaryJobLocation(null)).toBe('');});
