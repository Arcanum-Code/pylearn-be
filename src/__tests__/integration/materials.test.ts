import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { MaterialService } from "../../modules/materials/service";
import pino from "pino";
import { prisma } from "../../libs/prisma";
import { resetDatabase } from "../test_utils";

const log = pino({ level: "silent" });

describe("MaterialService - Upload & Sequence", () => {
  let lecturerId: string;
  let groupId: string;

  beforeEach(async () => {
    await resetDatabase();

    // Setup lecturer and group
    const role = await prisma.role.create({ data: { name: "Lecturer" } });
    const user = await prisma.user.create({
      data: {
        id: "lecturer-user-id",
        email: "lec@test.com",
        password: "hash",
        roleId: role.id,
      },
    });
    lecturerId = user.id;

    const group = await prisma.group.create({ data: { name: "G1" } });
    groupId = group.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should assign a default sequence of 1000 for the first material in a group", async () => {
    const mat = await MaterialService.createMaterial(
      {
        lecturerId,
        groupId,
        title: "M1",
        materialType: "text",
      },
      log,
    );
    expect(mat.sequence).toBe(1000);
    expect(mat.version).toBe(1);
  });

  it("should increment sequence by 1000 for subsequent materials in the group", async () => {
    const mat1 = await MaterialService.createMaterial(
      {
        lecturerId,
        groupId,
        title: "M1",
        materialType: "text",
      },
      log,
    );
    const mat2 = await MaterialService.createMaterial(
      {
        lecturerId,
        groupId,
        title: "M2",
        materialType: "text",
      },
      log,
    );
    expect(mat1.sequence).toBe(1000);
    expect(mat2.sequence).toBe(2000);
  });

  it("should increment version when forceReread is true", async () => {
    const mat = await MaterialService.createMaterial(
      {
        lecturerId,
        groupId,
        title: "M1",
        materialType: "text",
      },
      log,
    );

    const updated = await MaterialService.updateMaterial(
      BigInt(mat.id),
      {
        title: "M1 updated",
        forceReread: true,
      },
      log,
    );

    expect(updated.version).toBe(2);
  });
});
