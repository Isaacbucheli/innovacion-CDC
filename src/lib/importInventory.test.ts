import { describe, expect, test } from "vitest";
import { hasImportIssues, summarizeImportResult } from "@/lib/importInventory";

describe("summarizeImportResult", () => {
  test("sin errores ni warnings: suma el total importado y no reporta issues", () => {
    const summary = summarizeImportResult({
      summary: {
        snapshots: { imported: 184, insert_errors: 0, errors: [], warnings: [] },
        storage_files: { imported: 1, insert_errors: 0, errors: [], warnings: [] },
      },
    });
    expect(summary.totalImported).toBe(185);
    expect(summary.errors).toHaveLength(0);
    expect(summary.warnings).toHaveLength(0);
    expect(hasImportIssues(summary)).toBe(false);
  });

  test("warnings presentes: se aplanan con el servicio de origen y activan hasImportIssues", () => {
    const summary = summarizeImportResult({
      summary: {
        snapshots: { imported: 184, insert_errors: 0, errors: [], warnings: [] },
        storage_files: {
          imported: 1,
          insert_errors: 0,
          errors: [],
          warnings: [
            {
              credential_id: 6,
              warning: "stgazbdasrobprem: fileshares no consultados (HttpRequestException); cuenta omitida del análisis",
            },
          ],
        },
      },
    });
    expect(summary.totalImported).toBe(185);
    expect(hasImportIssues(summary)).toBe(true);
    expect(summary.errors).toHaveLength(0);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatchObject({
      service: "storage_files",
      serviceLabel: "Storage (Azure Files)",
      credentialId: 6,
      message: "stgazbdasrobprem: fileshares no consultados (HttpRequestException); cuenta omitida del análisis",
    });
  });

  test("errors presentes en varios servicios: se aplanan todos y se cuentan por separado de warnings", () => {
    const summary = summarizeImportResult({
      summary: {
        vms: { imported: 10, insert_errors: 0, errors: [{ credential_id: 1, error: "token expirado" }] },
        disks: { imported: 5, insert_errors: 2, warnings: [{ credential_id: 1, warning: "listado truncado" }] },
      },
    });
    expect(summary.totalImported).toBe(15);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ service: "vms", message: "token expirado" });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatchObject({ service: "disks", message: "listado truncado" });
    expect(hasImportIssues(summary)).toBe(true);
  });

  test("tolera 'summary', 'errors' y 'warnings' ausentes (respuestas antiguas o parciales)", () => {
    const summary = summarizeImportResult({ summary: { vms: { imported: 5, insert_errors: 0 } } });
    expect(summary.totalImported).toBe(5);
    expect(hasImportIssues(summary)).toBe(false);

    const empty = summarizeImportResult({ summary: {} });
    expect(empty.totalImported).toBe(0);
    expect(hasImportIssues(empty)).toBe(false);
  });
});
