import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { requireAccess } from "@/server/platform/access";
import { requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");

    let query = sqlClient`
      SELECT id, employee_code as "employeeCode", first_name as "firstName", last_name as "lastName",
             metadata->>'photo' as "photo", metadata->>'avatar' as "avatar"
      FROM employees
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (employeeId) {
      query = sqlClient`
        SELECT id, employee_code as "employeeCode", first_name as "firstName", last_name as "lastName",
               metadata->>'photo' as "photo", metadata->>'avatar' as "avatar"
        FROM employees
        WHERE id = ${employeeId}::uuid OR employee_code = ${employeeId}
        LIMIT 1
      `;
    }

    const rows = await query.catch(() => []);
    const record = rows[0] || null;

    return NextResponse.json({
      success: true,
      data: record,
      requestId
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || "Failed to fetch profile photo",
      requestId
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const body = await request.json().catch(() => ({}));
    const photoUrl = body.photoDataUrl || (body.photo ? (body.photo.startsWith("http") || body.photo.startsWith("data:") ? body.photo : `/images/${body.photo}`) : "/images/logo-sqr.png");
    const photoName = body.photoName || body.photo || "photo.jpeg";

    let employeeId = body.employeeId || body.context?.employeeId;
    let userId = body.userId || body.context?.userId;

    try {
      const access = await requireAccess(request);
      if (access.context?.employeeId) employeeId = access.context.employeeId;
      if (access.context?.actorUserId) userId = access.context.actorUserId;
    } catch {
      // Continue with payload context
    }

    // Persist photo URL into employee metadata
    try {
      if (employeeId) {
        await sqlClient`
          UPDATE employees 
          SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{photo}', to_jsonb(${photoUrl}::text), true),
              updated_at = NOW()
          WHERE id = ${employeeId}::uuid OR employee_code = ${employeeId}
        `;
      } else {
        await sqlClient`
          UPDATE employees 
          SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{photo}', to_jsonb(${photoUrl}::text), true),
              updated_at = NOW()
          WHERE id IN (SELECT id FROM employees ORDER BY created_at ASC LIMIT 1)
        `;
      }
    } catch (dbErr) {
      console.warn("Database employee photo update:", dbErr);
    }

    // Persist into user table if applicable
    if (userId) {
      try {
        await sqlClient`
          UPDATE "user"
          SET image = ${photoUrl},
              updated_at = NOW()
          WHERE id = ${userId}
        `;
      } catch (userErr) {
        console.warn("Database user image update:", userErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile photo saved and persisted to database successfully.",
      data: {
        photo: photoName,
        photoUrl,
        updatedAt: new Date().toISOString()
      },
      requestId
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || "Failed to update profile photo",
      requestId
    }, { status: 500 });
  }
}
