import { probeAtt2016Connection, introspectAtt2016Schema } from "@/modules/finger-system/integrations/att2016/adapter";
import { fetchAtt2016Machines } from "@/modules/finger-system/services/att2016-machines-import";
import { fetchAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-import";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import { mdbCountTable } from "@/modules/finger-system/integrations/att2016/mdb-reader";

export type Att2016RecognizeResult = {
  probe: Awaited<ReturnType<typeof probeAtt2016Connection>>;
  schema: Awaited<ReturnType<typeof introspectAtt2016Schema>>;
  counts: {
    userInfo: number;
    checkInOut: number;
    machines: number;
    templates: number;
  };
  machines: Awaited<ReturnType<typeof fetchAtt2016Machines>>;
  sampleUsers: { attUserId: number; badgeNumber: string; name: string | null }[];
};

/** Descarga y reconoce la base Microsoft Access (ATT2016) en la ruta configurada. */
export async function recognizeAtt2016Database(overrides?: {
  sharePath?: string | null;
  databaseName?: string | null;
}): Promise<Att2016RecognizeResult> {
  const probe = await probeAtt2016Connection(overrides);

  if (!probe.reachable) {
    return {
      probe,
      schema: { probedAt: new Date().toISOString(), tables: [], message: probe.message },
      counts: { userInfo: 0, checkInOut: 0, machines: 0, templates: 0 },
      machines: [],
      sampleUsers: [],
    };
  }

  const [schema, machines, users, counts] = await Promise.all([
    introspectAtt2016Schema(),
    fetchAtt2016Machines().catch(() => []),
    fetchAtt2016UserInfo().catch(() => []),
    withAtt2016MdbRead(async (mdb) => {
      const [userInfo, checkInOut, machinesCount, templates] = await Promise.all([
        mdbCountTable(mdb, "USERINFO").catch(() => 0),
        mdbCountTable(mdb, "CHECKINOUT").catch(() => 0),
        mdbCountTable(mdb, "Machines").catch(() => 0),
        mdbCountTable(mdb, "TEMPLATE").catch(() => 0),
      ]);
      return { userInfo, checkInOut, machines: machinesCount, templates };
    }).catch(() => ({ userInfo: 0, checkInOut: 0, machines: 0, templates: 0 })),
  ]);

  return {
    probe,
    schema,
    counts,
    machines,
    sampleUsers: users.slice(0, 8).map((u) => ({
      attUserId: u.attUserId,
      badgeNumber: u.badgeNumber,
      name: u.name,
    })),
  };
}
