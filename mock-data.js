// Sample stats used by the "Preview with sample data" button on the landing
// screen, so the Wrapped UI can be reviewed without an Apple Developer
// token. Shape matches what buildWrappedStats() produces in app.js.
window.MOCK_WRAPPED_STATS = {
  totalSongs: 2483,
  totalArtists: 412,
  totalAlbums: 356,
  totalDurationMs: 2483 * 3.6 * 60 * 1000,
  topGenres: [
    { name: "Alternative", count: 612 },
    { name: "Electronic", count: 498 },
    { name: "Hip-Hop/Rap", count: 371 },
    { name: "Indie Rock", count: 305 },
    { name: "R&B/Soul", count: 244 },
  ],
  topArtists: [
    { name: "Tame Impala", count: 61, artwork: null },
    { name: "Frank Ocean", count: 54, artwork: null },
    { name: "Radiohead", count: 47, artwork: null },
    { name: "Bonobo", count: 41, artwork: null },
    { name: "Mac Miller", count: 38, artwork: null },
  ],
  topAlbums: [
    { name: "Currents", artistName: "Tame Impala", count: 12, artwork: null },
    { name: "Blonde", artistName: "Frank Ocean", count: 11, artwork: null },
    { name: "In Rainbows", artistName: "Radiohead", count: 10, artwork: null },
    { name: "Circles", artistName: "Mac Miller", count: 9, artwork: null },
    { name: "Migration", artistName: "Bonobo", count: 9, artwork: null },
  ],
  decades: [
    { decade: 1970, count: 38 },
    { decade: 1980, count: 91 },
    { decade: 1990, count: 214 },
    { decade: 2000, count: 402 },
    { decade: 2010, count: 986 },
    { decade: 2020, count: 752 },
  ],
  oldestAdded: { name: "Motion Picture Soundtrack", artistName: "Radiohead", dateAdded: "2013-02-11" },
  newestAdded: { name: "Redbone", artistName: "Childish Gambino", dateAdded: "2026-08-01" },
  longestSong: { name: "Marble Skies", artistName: "Django Django", durationMs: 11 * 60 * 1000 + 42 * 1000 },
  isMock: true,
};
