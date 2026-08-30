import * as SQLite from 'expo-sqlite';
import { Track, Playlist, PlaylistTrack } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    try {
      db = await SQLite.openDatabaseAsync('waveform.db');
    } catch (e) {
      db = null;
      throw new Error(
        `[Waveform] Failed to open SQLite database. ` +
        `If this is a fresh install, try uninstalling and reinstalling the app ` +
        `to clear any conflicting files in the app data directory. ` +
        `Original error: ${e}`
      );
    }
  }
  if (!db) {
    throw new Error('[Waveform] SQLite database is not initialized.');
  }
  return db;
};

export const DatabaseService = {
  async initialize(): Promise<void> {
    const database = await getDb();
    await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        uri TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL DEFAULT 'Unknown Artist',
        album TEXT NOT NULL DEFAULT 'Unknown Album',
        duration REAL NOT NULL DEFAULT 0,
        artworkUri TEXT,
        artworkColor TEXT,
        fileSize INTEGER NOT NULL DEFAULT 0,
        dateAdded INTEGER NOT NULL,
        lastPlayedAt INTEGER,
        playCount INTEGER NOT NULL DEFAULT 0,
        isFavorite INTEGER NOT NULL DEFAULT 0,
        mood TEXT,
        bpmEstimate REAL
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        artworkUri TEXT,
        isAuto INTEGER NOT NULL DEFAULT 0,
        mood TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlistId TEXT NOT NULL,
        trackId TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (playlistId, trackId),
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
      CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
      CREATE INDEX IF NOT EXISTS idx_tracks_lastPlayedAt ON tracks(lastPlayedAt);
      CREATE INDEX IF NOT EXISTS idx_tracks_isFavorite ON tracks(isFavorite);
      CREATE INDEX IF NOT EXISTS idx_tracks_mood ON tracks(mood);
    `);
  },

  async upsertTracks(tracks: Track[]): Promise<void> {
    const database = await getDb();
    await database.withTransactionAsync(async () => {
      for (const track of tracks) {
        await database.runAsync(
          `INSERT INTO tracks (
            id, uri, filename, title, artist, album, duration,
            artworkUri, artworkColor, fileSize, dateAdded, lastPlayedAt,
            playCount, isFavorite, mood, bpmEstimate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(uri) DO UPDATE SET
            filename = excluded.filename,
            title = CASE WHEN excluded.title != '' THEN excluded.title ELSE tracks.title END,
            artist = CASE WHEN excluded.artist != 'Unknown Artist' THEN excluded.artist ELSE tracks.artist END,
            album = CASE WHEN excluded.album != 'Unknown Album' THEN excluded.album ELSE tracks.album END,
            duration = excluded.duration,
            artworkUri = COALESCE(excluded.artworkUri, tracks.artworkUri),
            artworkColor = COALESCE(excluded.artworkColor, tracks.artworkColor),
            fileSize = excluded.fileSize,
            mood = COALESCE(excluded.mood, tracks.mood),
            bpmEstimate = COALESCE(excluded.bpmEstimate, tracks.bpmEstimate)`,
          [
            track.id,
            track.uri,
            track.filename,
            track.title,
            track.artist,
            track.album,
            track.duration,
            track.artworkUri,
            track.artworkColor,
            track.fileSize,
            track.dateAdded,
            track.lastPlayedAt,
            track.playCount,
            track.isFavorite ? 1 : 0,
            track.mood,
            track.bpmEstimate,
          ]
        );
      }
    });
  },

  async getAllTracks(): Promise<Track[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<any>('SELECT * FROM tracks ORDER BY title ASC');
    return rows.map(rowToTrack);
  },

  async getTrackById(id: string): Promise<Track | null> {
    const database = await getDb();
    const row = await database.getFirstAsync<any>('SELECT * FROM tracks WHERE id = ?', [id]);
    return row ? rowToTrack(row) : null;
  },

  async getFavoriteTracks(): Promise<Track[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM tracks WHERE isFavorite = 1 ORDER BY title ASC'
    );
    return rows.map(rowToTrack);
  },

  async getRediscoverTracks(daysOld: number = 30): Promise<Track[]> {
    const database = await getDb();
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM tracks
       WHERE (lastPlayedAt IS NULL OR lastPlayedAt < ?)
       ORDER BY RANDOM()
       LIMIT 20`,
      [cutoff]
    );
    return rows.map(rowToTrack);
  },

  async getTracksByMood(mood: string): Promise<Track[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM tracks WHERE mood = ? ORDER BY RANDOM()',
      [mood]
    );
    return rows.map(rowToTrack);
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const database = await getDb();
    const track = await database.getFirstAsync<any>(
      'SELECT isFavorite FROM tracks WHERE id = ?',
      [id]
    );
    if (!track) return false;
    const newValue = track.isFavorite ? 0 : 1;
    await database.runAsync('UPDATE tracks SET isFavorite = ? WHERE id = ?', [newValue, id]);
    return newValue === 1;
  },

  async updateLastPlayed(id: string): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      'UPDATE tracks SET lastPlayedAt = ?, playCount = playCount + 1 WHERE id = ?',
      [Date.now(), id]
    );
  },

  async updateTrackColor(id: string, color: string): Promise<void> {
    const database = await getDb();
    await database.runAsync('UPDATE tracks SET artworkColor = ? WHERE id = ?', [color, id]);
  },

  async updateTrackDuration(id: string, duration: number): Promise<void> {
    const database = await getDb();
    await database.runAsync('UPDATE tracks SET duration = ? WHERE id = ?', [duration, id]);
  },

  async searchTracks(query: string): Promise<Track[]> {
    const database = await getDb();
    const pattern = `%${query}%`;
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM tracks
       WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
       ORDER BY title ASC
       LIMIT 50`,
      [pattern, pattern, pattern]
    );
    return rows.map(rowToTrack);
  },

  async getAllPlaylists(): Promise<Playlist[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<any>('SELECT * FROM playlists ORDER BY updatedAt DESC');
    return rows.map(rowToPlaylist);
  },

  async createPlaylist(playlist: Playlist): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      `INSERT INTO playlists (id, name, description, artworkUri, isAuto, mood, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        playlist.id,
        playlist.name,
        playlist.description,
        playlist.artworkUri,
        playlist.isAuto ? 1 : 0,
        playlist.mood,
        playlist.createdAt,
        playlist.updatedAt,
      ]
    );
  },

  async deletePlaylist(id: string): Promise<void> {
    const database = await getDb();
    await database.runAsync('DELETE FROM playlists WHERE id = ?', [id]);
  },

  async addTrackToPlaylist(playlistId: string, trackId: string, position: number): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      'INSERT OR REPLACE INTO playlist_tracks (playlistId, trackId, position) VALUES (?, ?, ?)',
      [playlistId, trackId, position]
    );
  },

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<any>(
      `SELECT t.* FROM tracks t
       INNER JOIN playlist_tracks pt ON t.id = pt.trackId
       WHERE pt.playlistId = ?
       ORDER BY pt.position ASC`,
      [playlistId]
    );
    return rows.map(rowToTrack);
  },

  async setMetadata(key: string, value: string): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
      [key, value]
    );
  },

  async getMetadata(key: string): Promise<string | null> {
    const database = await getDb();
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM metadata WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  },

  async getTrackCount(): Promise<number> {
    const database = await getDb();
    const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM tracks');
    return row?.count ?? 0;
  },

  async removeTracksNotInList(uris: string[]): Promise<void> {
    if (uris.length === 0) return;
    const database = await getDb();
    const placeholders = uris.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM tracks WHERE uri NOT IN (${placeholders})`,
      uris
    );
  },
};

function rowToTrack(row: any): Track {
  return {
    id: row.id,
    uri: row.uri,
    filename: row.filename,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    artworkUri: row.artworkUri,
    artworkColor: row.artworkColor,
    fileSize: row.fileSize,
    dateAdded: row.dateAdded,
    lastPlayedAt: row.lastPlayedAt,
    playCount: row.playCount,
    isFavorite: row.isFavorite === 1,
    mood: row.mood,
    bpmEstimate: row.bpmEstimate,
  };
}

function rowToPlaylist(row: any): Playlist {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    artworkUri: row.artworkUri,
    isAuto: row.isAuto === 1,
    mood: row.mood,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
