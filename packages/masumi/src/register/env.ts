import { z } from "zod";
import { defaultDatumDir, httpUrl } from "../env";

export const registerEnvSchema = z.object({
  MASUMI_PAYMENT_API_URL: httpUrl,
  MASUMI_ADMIN_KEY: z.string().min(32, "must be the MPS ADMIN_KEY"),
  MASUMI_SELLING_WALLET_ID: z.string().min(1),
  MASUMI_SELLER_ADDRESS: z.string().regex(/^addr_test1[0-9a-z]+$/, "must be a Preprod address"),
  DATUM_AGENT_API_URL: httpUrl,
  MASUMI_SETUP_DIR: z.string().min(1).default(defaultDatumDir("masumi-setup")),
});
