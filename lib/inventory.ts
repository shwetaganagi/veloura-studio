import "server-only";

import type { PoolClient } from "pg";

type InventoryMovementInput = {
  productId: string | number;
  orderId?: string | number | null;
  movementType: "production" | "adjustment" | "sale" | "restock";
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  idempotencyKey: string;
  actor: string;
};

export async function recordInventoryMovement(
  client: PoolClient,
  movement: InventoryMovementInput
) {
  await client.query(
    `INSERT INTO inventory_movements (
       product_id, order_id, movement_type, quantity_change,
       stock_before, stock_after, reason, idempotency_key, actor
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      movement.productId,
      movement.orderId ?? null,
      movement.movementType,
      movement.quantityChange,
      movement.stockBefore,
      movement.stockAfter,
      movement.reason,
      movement.idempotencyKey,
      movement.actor,
    ]
  );
}

export async function hasPaymentInventoryReservations(client: PoolClient) {
  const result = await client.query<{ available: boolean }>(
    `SELECT to_regclass('public.payment_inventory_reservations') IS NOT NULL
       AS available`
  );
  return result.rows[0]?.available === true;
}

export async function hasInventoryLifecycleSchema(client: PoolClient) {
  const result = await client.query<{
    ready: boolean;
  }>(
    `SELECT
       to_regclass('public.inventory_movements') IS NOT NULL
       AND to_regclass('public.payment_inventory_reservations') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
           AND column_name = 'payment_method'
       )
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
           AND column_name = 'payment_status'
       )
       AS ready`
  );
  return result.rows[0]?.ready === true;
}
