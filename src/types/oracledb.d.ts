declare module "oracledb" {
  export type BindParameters = Record<string, unknown>;

  export interface Connection {
    execute<T = Record<string, unknown>>(
      sql: string,
      binds?: BindParameters,
      options?: Record<string, unknown>,
    ): Promise<{ rows?: T[]; outBinds?: Record<string, unknown> }>;
    close(): Promise<void>;
  }

  interface OracleDB {
    initOracleClient(options: { libDir: string }): void;
    getConnection(options: {
      user: string;
      password: string;
      connectString: string;
      connectTimeout?: number;
    }): Promise<Connection>;
    outFormat: number;
    OUT_FORMAT_OBJECT: number;
    BIND_IN: number;
    BIND_OUT: number;
    STRING: number;
    NUMBER: number;
    DATE: number;
  }

  const oracledb: OracleDB;
  export default oracledb;
  export = oracledb;
}
