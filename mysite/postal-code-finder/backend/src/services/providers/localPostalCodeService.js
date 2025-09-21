const fs = require('fs');
const path = require('path');
const config = require('../../config');
const addressParser = require('../../utils/addressParser');

class LocalPostalCodeService {
  constructor() {
    this.dataPath = config.postal.localDataPath;
    this.records = [];
    this.byRoadKey = new Map(); // key: sido|sigungu|road|main|sub
    this.byPostal = new Map(); // key: postalCode -> array of records
    this.loaded = false;
    this.loadError = null;
    this._loadData();
  }

  _detectDelimiter(headerLine) {
    if (headerLine.includes('\t')) return '\t';
    return ',';
  }

  _safeSplit(line, delimiter) {
    // Very simple splitter: does not support quoted commas.
    // Use TSV or simple CSV without embedded commas for reliability.
    return line.split(delimiter).map(s => s.trim());
  }

  _loadData() {
    try {
      const resolved = path.isAbsolute(this.dataPath)
        ? this.dataPath
        : path.join(process.cwd(), this.dataPath);
      if (!fs.existsSync(resolved)) {
        console.warn(`⚠️ Local postal data not found at ${resolved}. Using empty dataset.`);
        this.loaded = true;
        return;
      }
      const raw = fs.readFileSync(resolved, 'utf8');
      const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        this.loaded = true;
        return;
      }
      const delimiter = this._detectDelimiter(lines[0]);
      const header = this._safeSplit(lines[0], delimiter);
      const idx = {
        postalCode: header.indexOf('postalCode'),
        sido: header.indexOf('sido'),
        sigungu: header.indexOf('sigungu'),
        roadName: header.indexOf('roadName'),
        buildingMain: header.indexOf('buildingMain'),
        buildingSub: header.indexOf('buildingSub'),
        legalDong: header.indexOf('legalDong'),
        jibunMain: header.indexOf('jibunMain'),
        jibunSub: header.indexOf('jibunSub'),
        fullAddress: header.indexOf('fullAddress'),
      };

      for (let i = 1; i < lines.length; i++) {
        const parts = this._safeSplit(lines[i], delimiter);
        const rec = {
          postalCode: parts[idx.postalCode] || '',
          sido: parts[idx.sido] || '',
          sigungu: parts[idx.sigungu] || '',
          roadName: parts[idx.roadName] || '',
          buildingMain: parts[idx.buildingMain] || '',
          buildingSub: parts[idx.buildingSub] || '',
          legalDong: parts[idx.legalDong] || '',
          jibunMain: parts[idx.jibunMain] || '',
          jibunSub: parts[idx.jibunSub] || '',
          fullAddress: parts[idx.fullAddress] || '',
        };
        this.records.push(rec);

        const roadKey = this._roadKey(rec.sido, rec.sigungu, rec.roadName, rec.buildingMain, rec.buildingSub);
        if (roadKey) this.byRoadKey.set(roadKey, rec);
        if (rec.postalCode) {
          if (!this.byPostal.has(rec.postalCode)) this.byPostal.set(rec.postalCode, []);
          this.byPostal.get(rec.postalCode).push(rec);
        }
      }
      this.loaded = true;
      console.log(`📦 Loaded ${this.records.length} postal records from ${resolved}`);
    } catch (e) {
      this.loadError = e;
      this.loaded = true;
      console.error('Failed to load local postal data:', e.message);
    }
  }

  _roadKey(sido, sigungu, road, main, sub) {
    if (!sido || !sigungu || !road || !main) return null;
    const s = String(sub || '').trim();
    return `${sido}|${sigungu}|${road}|${String(main)}|${s}`;
  }

  _extractBuildingNumbers(address, road) {
    // Find first number after the road token
    const norm = addressParser.normalizeAddress(address);
    const idx = norm.indexOf(road);
    let main = '', sub = '';
    if (idx >= 0) {
      const tail = norm.slice(idx + road.length);
      const m = tail.match(/\s*(\d+)(?:-(\d+))?/);
      if (m) {
        main = m[1] || '';
        sub = m[2] || '';
      }
    } else {
      const m = norm.match(/(\d+)(?:-(\d+))?/);
      if (m) {
        main = m[1] || '';
        sub = m[2] || '';
      }
    }
    return { main, sub };
  }

  async findPostalCode(address) {
    if (!this.loaded) this._loadData();
    if (this.loadError) throw this.loadError;

    const normalized = addressParser.normalizeAddress(address);
    const comp = addressParser.parseAddressComponents(normalized);

    if (comp.road) {
      const { main, sub } = this._extractBuildingNumbers(normalized, comp.road);
      // Try exact match main+sub
      let key = this._roadKey(comp.sido, comp.sigungu, comp.road, main, sub);
      if (key && this.byRoadKey.has(key)) {
        return this._toResult(this.byRoadKey.get(key));
      }
      // Try without sub
      key = this._roadKey(comp.sido, comp.sigungu, comp.road, main, '');
      if (key && this.byRoadKey.has(key)) {
        return this._toResult(this.byRoadKey.get(key));
      }
      // Try any record with same road and main
      const prefix = `${comp.sido}|${comp.sigungu}|${comp.road}|${main}|`;
      for (const [k, rec] of this.byRoadKey.entries()) {
        if (k.startsWith(prefix)) return this._toResult(rec);
      }
      // Fallback: ignore region, match by road and main only
      for (const [k, rec] of this.byRoadKey.entries()) {
        const parts = k.split('|');
        if (parts.length >= 5 && parts[2] === comp.road && parts[3] === String(main)) {
          return this._toResult(rec);
        }
      }
    }

    // Fallback: contains a known fullAddress substring
    const compact = normalized.replace(/\s+/g, '');
    for (const rec of this.records) {
      if (!rec.fullAddress) continue;
      const recCompact = rec.fullAddress.replace(/\s+/g, '');
      if (compact.includes(recCompact)) {
        return this._toResult(rec);
      }
    }

    return null;
  }

  _toResult(rec) {
    return {
      postalCode: rec.postalCode || '',
      fullAddress: rec.fullAddress || `${rec.sido} ${rec.sigungu} ${rec.roadName} ${rec.buildingMain}${rec.buildingSub ? '-' + rec.buildingSub : ''}`.trim(),
      sido: rec.sido || '',
      sigungu: rec.sigungu || '',
      roadName: rec.roadName || '',
      buildingNumber: rec.buildingMain || '',
      coordinates: null
    };
  }

  async getAutocomplete(query, limit = 10) {
    if (!this.loaded) this._loadData();
    const q = (query || '').trim();
    if (!q) return [];
    const out = [];
    for (const rec of this.records) {
      const addr = rec.fullAddress || `${rec.sido} ${rec.sigungu} ${rec.roadName}`;
      if (addr.includes(q)) {
        out.push({ address: addr, postalCode: rec.postalCode || '', category: 'ROAD' });
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  async findByPostalCode(postalCode) {
    if (!this.loaded) this._loadData();
    const arr = this.byPostal.get(String(postalCode)) || [];
    return arr.map(rec => ({
      address: rec.fullAddress || `${rec.sido} ${rec.sigungu} ${rec.roadName}`,
      postalCode: rec.postalCode,
      sido: rec.sido,
      sigungu: rec.sigungu
    }));
  }

  async getSuggestions(address) {
    // naive suggestion: top 5 autocomplete matches by tokens
    const tokens = addressParser.normalizeAddress(address).split(' ').filter(Boolean);
    const q = tokens.find(t => t.length > 1) || tokens[0] || '';
    return this.getAutocomplete(q, 5);
  }
}

module.exports = LocalPostalCodeService;
