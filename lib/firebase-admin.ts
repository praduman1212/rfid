import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (json) {
    const raw = JSON.parse(json) as ServiceAccount & { project_id?: string };
    const credentials: ServiceAccount = raw;
    return initializeApp({
      credential: cert(credentials),
      projectId: raw.project_id ?? credentials.projectId ?? projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getAdminDb() {
  initAdminApp();
  return getFirestore();
}
