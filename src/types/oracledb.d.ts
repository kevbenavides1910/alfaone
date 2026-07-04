declare module "oracledb" {
  const oracledb: {
    initOracleClient(options: { libDir: string }): void;
    getConnection(options: {
      user: string;
      password: string;
      connectString: string;
      connectTimeout?: number;
    }): Promise<Connection>;
    outFormat: number;
    OUT_FORMAT_OBJECT: number;
  };
  export = oracledb;

  export interface Connection {
    execute<T = Record<string, unknown>>(
      sql: string,
      binds?: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<{ rows?: T[] }>;
    close(): Promise<void>;
  }
}
