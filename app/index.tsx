import { Redirect } from "expo-router";
import React from "react";

// Index route instantly redirects to splash using <Redirect /> so navigation occurs
// after router + Root Layout are mounted, avoiding early navigation errors.
export default function Index() {
  return <Redirect href={"/splash" as any} />;
}
