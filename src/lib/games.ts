import { eq, asc } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export type GamesFilter = {
    categoryIds?: number[];
    publisherId?: number | null;
};

/** All games ordered by title. Supports optional in-memory filtering by category ids and publisher id. */
export async function getAllGames(db: Database, filters?: GamesFilter): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    const mapped = rows.map(mapGame);

    if (!filters) return mapped;

    return mapped.filter((g) => {
        if (filters.categoryIds && filters.categoryIds.length > 0) {
            const hasCategory = g.category && filters.categoryIds.includes(g.category.id);
            if (!hasCategory) return false;
        }
        if (typeof filters.publisherId === 'number') {
            if (!g.publisher || g.publisher.id !== filters.publisherId) return false;
        }
        return true;
    });
}

/** All categories (id + name) ordered by name. */
export async function getAllCategories(db: Database): Promise<{ id: number; name: string }[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((r: any) => ({ id: r.id as number, name: r.name as string }));
}

/** All publishers (id + name) ordered by name. */
export async function getAllPublishers(db: Database): Promise<{ id: number; name: string }[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((r: any) => ({ id: r.id as number, name: r.name as string }));
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
