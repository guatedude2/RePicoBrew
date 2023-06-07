import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@example.com',
      password: 'f4b81f0e7d8a18c99dc6cde47a70d2ea517f1de1aecb45c805126e3ad412dec5',
      salt: 'e8cccb99c10a449af4c90570ad2b6c86',
    },
  });

  await prisma.config.create({
    data: {
      key: 'DEVICE_FIRMWARE',
      value: JSON.stringify({
        PICOBREW_C: { version: '0.1.34', file: '/firmwares/pico/pico_c_0_1_34.bin' },
      }),
    },
  });
  await prisma.config.create({
    data: {
      key: 'DEVICE_MAX_SESSIONS_TO_DEEP_CLEAN',
      value: JSON.stringify({
        PICOBREW_C: 3,
      }),
    },
  });

  await prisma.recipe.create({
    data: {
      deviceType: 'PICOBREW_C',
      name: 'Base Recipe - American Amber Ale',
      abv: 6.4,
      ibu: 35.0,
      image:
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fffe000ffc01ffffc0000000000000003fff0003f601ff7ff0000000000000000fe7c00dff003de7f8000800030000000ff3e000ff801ff7f80078001fe000000dfbe000ff801feff80070001fe0000009c37000de000dffc0007803ffe0000021c070001c000cbf80007803ffe000000dcbf800dc0002ff0000780ffff000000fc9f800fc0003fe00007a3ffff800003fc1f800fc0000dc00007ffffff000003fc3f801dc0000fc00007f1f8bf000002bcb7800dc0000dc00007f0f9fffc00003c278001c00021c00007f079ff0600023c0f8021c00021c00007fe10fe0200003c1f8001c00021c00007e000ff00000c1c3f00c1c000c1c00007e080ff00000000fe0080600000600007e010ff00000ffffc00fff000fff00007e001ff00000ffff800fff800fff80007e001ff000007ffe0007ff8003ff80007f000fe00000000000000000000000007f001fe00fffe03fff003fffcfffbff87f001fe001fffc0ffff03fffcffffffc7e0007e00cfff633c3f807e3e1cfdede7e0017e006fffb13f9fc03f9f3dfdefe7e0017e000ffff8bfefc03fdf3cffe7e7e0017e0007eef8b7ffe037df1cfdf787f0017e0001e6bc87a7e0073f18f8ff07f0017e0005cc3c841bf02fbf1aefff07f8dffe02070d7c3c3ff030df1e4ece07fdffff8c24067c303fe0ffe00e0e4e07fdffff003df778f79bc0ffe00f1f0e07fddffe010dff30bfcdf0afec0f1f0e07fc08ff7015fd38afedb82fce0f1e1e07fffffe0001e4388f21bc8f0f061e1c07fffffc0001e03c8f203c0f4f061e1c07e0017c0061f07f07003d078f063e1c07c0003e000000fe01987c000f033f1c03e0007c00ffffffffcfffffff03fff800ff9ff000fffffbffeffbffff03fbf800000000007fffe1ffe3f1ffff00f9f800000000001fff00ffc0c0fffe007070000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      notes:
        '### [Base Recipe] A bitter, copper amber ale. It is neutral-bodied and high-strength with citrus, floral and spice notes.\n\n**OG**: 1.059   **FG**: 1.011\n**ABV**: ~6.4%    **IBU**: ~35\n\n**SRM**: 17.0   **Batch Size**: 1.3 Gal / 5L   **Start Water**: 1.4 Gal / 5.3 L (11.7 lbs)\n\n#### Grain Bill (total weight: 8.73lb)\n\n| Grain/Sugar  | Weight | Color (\u00b0Lovibond) | Gravity | Notes | \n| ------------------- | ------- | ------------- |\n| American Two-Row Pale | 3.75lb | 1.8\u00b0L | 1.0368 |\n| American Crystal 60L | 3.5oz | 60\u00b0L | 1.034 |\n| American Crystal 120L | 3.5oz | 120\u00b0L | 1.033 |\n  \n#### Hop Schedule\n  \n| Variety/Adjunct  | Weight | Alpha Acid (AA%) | Notes | \n| ------------- | -----: | ----- |\n| Summit | 17g (.6oz) | 16% | @ 30m |\n| Cascade | 5.67g (.2oz) | 7.1% | @ 20m |\n| Centennial | 5.67g (.2oz) | 9.3% | @ 20m |\n| Cascade | 5.67g (.2oz) | 7.1% | @ 15m |\n| Centennial | 5.67g (.2oz) | 9.3% | @ 10m |\n\n##### Optional Additions/Customizations\n\n  \n  \n##### Fermentation\nFermentis (US-05) - SafAle - 78-82% attenuation, 62-82\u00b0F, pitch temp 65\u00b0F\n  \n| Purpose  | Temp | Time | \n| ------------- | -----: | ----- |\n| Primary | 68\u00b0F | 10d |\n| Cold Crash | 38-42\u00b0F  | 1-3d |',
      steps: {
        create: [
          {
            drainTime: 0,
            location: 'Prime',
            name: 'Preparing To Brew',
            stepTime: 3,
            temperature: 0,
          },
          {
            drainTime: 0,
            location: 'PassThru',
            name: 'Heating',
            stepTime: 0,
            temperature: 110,
          },
          {
            drainTime: 0,
            location: 'Mash',
            name: 'Dough In',
            stepTime: 7,
            temperature: 110,
          },
          {
            drainTime: 0,
            location: 'Mash',
            name: 'Mash 1',
            stepTime: 25,
            temperature: 148,
          },
          {
            drainTime: 0,
            location: 'Mash',
            name: 'Mash 2',
            stepTime: 20,
            temperature: 156,
          },
          {
            drainTime: 2,
            location: 'Mash',
            name: 'Mash Out',
            stepTime: 7,
            temperature: 178,
          },
          {
            drainTime: 0,
            location: 'Adjunct1',
            name: 'Hops 1',
            stepTime: 10,
            temperature: 202,
          },
          {
            drainTime: 0,
            location: 'Adjunct2',
            name: 'Hops 2',
            stepTime: 5,
            temperature: 202,
          },
          {
            drainTime: 0,
            location: 'Adjunct3',
            name: 'Hops 3',
            stepTime: 5,
            temperature: 202,
          },
          {
            drainTime: 5,
            location: 'Adjunct4',
            name: 'Hops 4',
            stepTime: 10,
            temperature: 202,
          },
        ],
      },
    },
  });

  // TODO: remove mock device and data
  await prisma.device.create({
    data: {
      name: 'PicoBrew Kitchen',
      uid: '5c11b9a5b047159662038ea2261bf2e4',
      deviceType: 'PICOBREW_C',
    },
  });

  console.log('Seed data generated!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
