import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters by category and publisher', async () => {
        // create two categories and two publishers
        const [catA] = await db.insert(categories).values({ name: 'Cat A', description: 'a' }).returning({ id: categories.id });
        const [catB] = await db.insert(categories).values({ name: 'Cat B', description: 'b' }).returning({ id: categories.id });
        const [pubX] = await db.insert(publishers).values({ name: 'Pub X', description: 'x' }).returning({ id: publishers.id });
        const [pubY] = await db.insert(publishers).values({ name: 'Pub Y', description: 'y' }).returning({ id: publishers.id });

        await db.insert(games).values({ title: 'G1', description: 'g1', starRating: 5, categoryId: catA.id, publisherId: pubX.id });
        await db.insert(games).values({ title: 'G2', description: 'g2', starRating: 5, categoryId: catB.id, publisherId: pubX.id });
        await db.insert(games).values({ title: 'G3', description: 'g3', starRating: 5, categoryId: catA.id, publisherId: pubY.id });

        const byCatA = await getAllGames(db, { categoryIds: [catA.id] });
        expect(byCatA.map((g) => g.title).sort()).toEqual(expect.arrayContaining(['G1', 'G3']));

        const byPubX = await getAllGames(db, { publisherId: pubX.id });
        expect(byPubX.map((g) => g.title).sort()).toEqual(expect.arrayContaining(['G1', 'G2']));

        const combined = await getAllGames(db, { categoryIds: [catA.id], publisherId: pubX.id });
        expect(combined.map((g) => g.title)).toEqual(['G1']);
    });
});
