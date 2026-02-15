import { Connection, clusterApiUrl } from "@solana/web3.js";
import { CLUSTERS } from "../domain/validation.js";

export function resolveClusterEndpoint(cluster) {
  if (!CLUSTERS.includes(cluster)) {
    throw new Error(`Unsupported Solana cluster: ${cluster}`);
  }
  return clusterApiUrl(cluster);
}

export function createSolanaConnection(cluster, options = {}) {
  const endpoint = options.endpoint || resolveClusterEndpoint(cluster);
  const connectionFactory =
    options.connectionFactory ||
    ((rpcEndpoint, commitment) => new Connection(rpcEndpoint, commitment));
  return connectionFactory(endpoint, "confirmed");
}

export function createConnectionContext(cluster, options = {}) {
  const endpoint = options.endpoint || resolveClusterEndpoint(cluster);
  const connection = createSolanaConnection(cluster, {
    endpoint,
    connectionFactory: options.connectionFactory,
  });

  return {
    cluster,
    endpoint,
    connection,
  };
}
