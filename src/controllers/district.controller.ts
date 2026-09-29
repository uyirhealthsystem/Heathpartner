import { Request, Response } from "express";
import {
  districtHealthPartnersQuerySchema,
  locationNameSchema,
} from "../schemas/location.schema";
import {
  createBlock,
  createDistrict,
  createVillage,
  getDistrictHealthPartners,
  getDistrictSummary,
  listBlocks,
  listDistricts,
  listVillages,
} from "../services/location.service";

function fail(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  return res.status(400).json({ message });
}

function param(req: Request, name: string) {
  return String(req.params[name]);
}

export async function districts(_req: Request, res: Response) {
  try {
    return res.json(await listDistricts());
  } catch (error) {
    return fail(res, error, "Failed to load districts");
  }
}

export async function addDistrict(req: Request, res: Response) {
  try {
    const body = locationNameSchema.parse(req.body);

    return res.status(201).json(await createDistrict(body.name));
  } catch (error) {
    return fail(res, error, "Failed to create district");
  }
}

export async function blocks(req: Request, res: Response) {
  try {
    return res.json(await listBlocks(param(req, "districtId")));
  } catch (error) {
    return fail(res, error, "Failed to load blocks");
  }
}

export async function addBlock(req: Request, res: Response) {
  try {
    const body = locationNameSchema.parse(req.body);

    return res
      .status(201)
      .json(await createBlock(param(req, "districtId"), body.name));
  } catch (error) {
    return fail(res, error, "Failed to create block");
  }
}

export async function villages(req: Request, res: Response) {
  try {
    return res.json(
      await listVillages(param(req, "districtId"), param(req, "blockId"))
    );
  } catch (error) {
    return fail(res, error, "Failed to load villages");
  }
}

export async function addVillage(req: Request, res: Response) {
  try {
    const body = locationNameSchema.parse(req.body);

    return res
      .status(201)
      .json(
        await createVillage(
          param(req, "districtId"),
          param(req, "blockId"),
          body.name
        )
      );
  } catch (error) {
    return fail(res, error, "Failed to create village");
  }
}

export async function healthPartners(req: Request, res: Response) {
  try {
    const query = districtHealthPartnersQuerySchema.parse(req.query);

    return res.json(
      await getDistrictHealthPartners(param(req, "districtId"), query)
    );
  } catch (error) {
    return fail(res, error, "Failed to load district Health Partners");
  }
}

export async function summary(req: Request, res: Response) {
  try {
    return res.json(await getDistrictSummary(param(req, "districtId")));
  } catch (error) {
    return fail(res, error, "Failed to load district summary");
  }
}
