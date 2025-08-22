import { describe, expect, it, beforeEach, mock } from "bun:test";
import { BoxHandle } from "../src/box-handle";
import { Box, BoxState, Snapshot } from "../src/models";

describe("BoxHandle Snapshots", () => {
  let mockHttpClient: any;
  let mockBox: Box;
  let boxHandle: BoxHandle;

  beforeEach(() => {
    mockHttpClient = {
      request: mock(() => Promise.resolve({ data: {} })),
    };

    mockBox = {
      id: "box-123",
      status: BoxState.RUNNING,
      timeout: 600,
      created_at: new Date().toISOString(),
    };

    boxHandle = new BoxHandle(mockBox, {
      apiKey: "test-key",
      baseUrl: "https://api.devento.ai",
      httpClient: mockHttpClient,
      timeout: 30000,
    });
  });

  describe("listSnapshots", () => {
    it("should list all snapshots for a box", async () => {
      const mockSnapshots: Snapshot[] = [
        {
          id: "snap-1",
          box_id: "box-123",
          snapshot_type: "disk",
          status: "ready",
          label: "backup-1",
          size_bytes: 1024000,
          checksum_sha256: "abc123",
          created_at: new Date().toISOString(),
          orchestrator_id: "orch-1",
        },
        {
          id: "snap-2",
          box_id: "box-123",
          snapshot_type: "disk",
          status: "creating",
          created_at: new Date().toISOString(),
          orchestrator_id: "orch-1",
        },
      ];

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshots },
      });

      const snapshots = await boxHandle.listSnapshots();
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://api.devento.ai/api/v2/boxes/box-123/snapshots",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: undefined,
        timeout: 30000,
      });
      
      expect(snapshots).toEqual(mockSnapshots);
      expect(snapshots).toHaveLength(2);
    });
  });

  describe("getSnapshot", () => {
    it("should fetch a specific snapshot", async () => {
      const mockSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "ready",
        label: "backup-1",
        size_bytes: 1024000,
        checksum_sha256: "abc123",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshot },
      });

      const snapshot = await boxHandle.getSnapshot("snap-1");
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://api.devento.ai/api/v2/boxes/box-123/snapshots/snap-1",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: undefined,
        timeout: 30000,
      });
      
      expect(snapshot).toEqual(mockSnapshot);
    });
  });

  describe("createSnapshot", () => {
    it("should create a snapshot with label and description", async () => {
      const mockSnapshot: Snapshot = {
        id: "snap-new",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "creating",
        label: "before-upgrade",
        description: "Snapshot before system upgrade",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshot },
      });

      const snapshot = await boxHandle.createSnapshot({
        label: "before-upgrade",
        description: "Snapshot before system upgrade",
      });
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.devento.ai/api/v2/boxes/box-123/snapshots",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: {
          label: "before-upgrade",
          description: "Snapshot before system upgrade",
        },
        timeout: 30000,
      });
      
      expect(snapshot).toEqual(mockSnapshot);
      expect(snapshot.status).toBe("creating");
    });

    it("should create a snapshot without parameters", async () => {
      const mockSnapshot: Snapshot = {
        id: "snap-new",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "creating",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshot },
      });

      const snapshot = await boxHandle.createSnapshot();
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.devento.ai/api/v2/boxes/box-123/snapshots",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: {},
        timeout: 30000,
      });
      
      expect(snapshot).toEqual(mockSnapshot);
    });
  });

  describe("restoreSnapshot", () => {
    it("should restore a snapshot", async () => {
      const mockSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "restoring",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshot },
      });

      const snapshot = await boxHandle.restoreSnapshot("snap-1");
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.devento.ai/api/v2/boxes/box-123/restore",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: { snapshot_id: "snap-1" },
        timeout: 30000,
      });
      
      expect(snapshot.status).toBe("restoring");
    });
  });

  describe("deleteSnapshot", () => {
    it("should delete a snapshot", async () => {
      const mockSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "deleted",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: mockSnapshot },
      });

      const snapshot = await boxHandle.deleteSnapshot("snap-1");
      
      expect(mockHttpClient.request).toHaveBeenCalledWith({
        method: "DELETE",
        url: "https://api.devento.ai/api/v2/boxes/box-123/snapshots/snap-1",
        headers: {
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        },
        data: undefined,
        timeout: 30000,
      });
      
      expect(snapshot.status).toBe("deleted");
    });
  });

  describe("waitSnapshotReady", () => {
    it("should wait until snapshot is ready", async () => {
      const creatingSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "creating",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      const readySnapshot: Snapshot = {
        ...creatingSnapshot,
        status: "ready",
      };

      mockHttpClient.request
        .mockResolvedValueOnce({ data: { data: creatingSnapshot } })
        .mockResolvedValueOnce({ data: { data: creatingSnapshot } })
        .mockResolvedValueOnce({ data: { data: readySnapshot } });

      await boxHandle.waitSnapshotReady("snap-1", {
        timeoutMs: 5000,
        pollIntervalMs: 10,
      });

      expect(mockHttpClient.request).toHaveBeenCalledTimes(3);
    });

    it("should throw error if snapshot fails", async () => {
      const errorSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "error",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: errorSnapshot },
      });

      expect(
        boxHandle.waitSnapshotReady("snap-1", {
          timeoutMs: 5000,
          pollIntervalMs: 10,
        })
      ).rejects.toThrow("Snapshot snap-1 ended with status: error");
    });

    it("should throw error if snapshot is deleted", async () => {
      const deletedSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "deleted",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValueOnce({
        data: { data: deletedSnapshot },
      });

      expect(
        boxHandle.waitSnapshotReady("snap-1", {
          timeoutMs: 5000,
          pollIntervalMs: 10,
        })
      ).rejects.toThrow("Snapshot snap-1 ended with status: deleted");
    });

    it("should throw error on timeout", async () => {
      const creatingSnapshot: Snapshot = {
        id: "snap-1",
        box_id: "box-123",
        snapshot_type: "disk",
        status: "creating",
        created_at: new Date().toISOString(),
        orchestrator_id: "orch-1",
      };

      mockHttpClient.request.mockResolvedValue({
        data: { data: creatingSnapshot },
      });

      expect(
        boxHandle.waitSnapshotReady("snap-1", {
          timeoutMs: 50,
          pollIntervalMs: 10,
        })
      ).rejects.toThrow("Snapshot snap-1 did not become ready within 50ms");
    });
  });
});