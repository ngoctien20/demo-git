#!/usr/bin/env node
/**
 * RPC17.8D PRIVATE-ONLY / GET-ONLY operator CLI.
 * Never call from GitHub Actions with real secrets, or put access tokens in chat.
 * Keep SUPABASE_ACCESS_TOKEN only in an approved private secret broker/environment.
 */
import { inspectBackupInventory } from './backup-inventory.mjs';

if (process.env.RPC178D_PRIVATE_READONLY !== 'YES') {
  console.log(JSON.stringify({status:'BLOCKED',reason:'PRIVATE_OPERATOR_OPT_IN_REQUIRED'}));
  process.exitCode = 2;
} else {
  const result = await inspectBackupInventory({
    fetchImpl: fetch,
    token: process.env.SUPABASE_ACCESS_TOKEN
  });
  console.log(JSON.stringify(result));
  // Inventory is evidence, NOT proof of a successful restore or DDL GO.
  if (result.status !== 'INVENTORY_OBSERVED_RESTORE_UNVERIFIED') process.exitCode = 2;
}
