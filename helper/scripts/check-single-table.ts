import { getClient } from "./seeder/types";

async function main() {
  const client = getClient();
  const res = await client`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tool_invocations'
    ORDER BY ordinal_position
  `;
  console.log("tool_invocations columns:", res);

  const resVer = await client`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'verification'
    ORDER BY ordinal_position
  `;
  console.log("verification columns:", resVer);
}

main().catch(console.error);
