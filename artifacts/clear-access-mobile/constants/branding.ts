import appConfig from '../app.json';

const appName = appConfig.expo.name.trim();
const copyrightNotice = appConfig.expo.extra?.copyrightNotice?.trim();

if (!appName || !copyrightNotice) {
  throw new Error('The app name and copyright notice must be set in app.json.');
}

export const APP_NAME = appName;
export const COPYRIGHT_NOTICE = copyrightNotice;
