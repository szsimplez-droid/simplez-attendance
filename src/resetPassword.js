import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
