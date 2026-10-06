import { describe, expect, it } from "vitest";
import { publicAddressesOnly } from "../../src/brand-page/address-policy";

describe("publicAddressesOnly", () => {
  it.each([
    "127.0.0.1",
    "127.8.9.10",
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.170",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd00:ec2::254",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::a00:1",
    "2002:a00:1::",
    "2001:db8::1",
    "ff02::1",
  ])("refuses the non-public address %s", (address) => {
    expect(publicAddressesOnly(address)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "76.13.10.76",
    "::ffff:8.8.8.8",
    "2606:4700:4700::1111",
  ])("accepts the public address %s", (address) => {
    expect(publicAddressesOnly(address)).toBe(true);
  });

  it.each(["localhost", "example.com", "", "127.0.0.1:80"])(
    "refuses %j because it is not an IP address",
    (value) => {
      expect(publicAddressesOnly(value)).toBe(false);
    },
  );
});
