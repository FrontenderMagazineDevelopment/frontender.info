#!/usr/bin/env bash

export RESULT_DIR=frontender.info.${TRAVIS_BUILD_NUMBER}
export SSHPASS=${SSH_PASS}
export ARCH_NAME=frontender.info.package.tgz
export SYMLINK_NAME=frontender.info
export PROCESS_NAME=frontender.info

mkdir ${RESULT_DIR}
shopt -s extglob
ls
echo '1';
mv -f -v !(${RESULT_DIR}) ./${RESULT_DIR}
echo '2';
mv -f -v ./{.[!.],}* ./${RESULT_DIR}
ls -lah ./${RESULT_DIR}
echo '3';
ls -lah
tar -czf ${ARCH_NAME} ${RESULT_DIR}
ls -lah
echo 'scp';
sshpass -e scp -C -o StrictHostKeyChecking=no ${ARCH_NAME} ${SSH_USER}@${SSH_IP}:${WEB_PATH}
echo 'ssh';
sshpass -e ssh -C ${SSH_USER}@${SSH_IP} << EOF
cd ${WEB_PATH};
tar -xzf ./${ARCH_NAME} -C ./;
rm ./${ARCH_NAME};
ls -dt ${WEB_PATH}*/ | tail -n +5 | xargs rm -rf;
rm ./.env
if [ ! -f ".env" ]; then
    echo JWT_SECRET=${JWT_SECRET} >> .env
    echo COOKIE_SECRET=${COOKIE_SECRET} >> .env
fi
cd ${RESULT_DIR};
export NODE_ENV=production;
npm i;
cd ..
rm -dRf ${SYMLINK_NAME}
ln -ds ${RESULT_DIR} ./${SYMLINK_NAME}
cd ./${SYMLINK_NAME}
npm run build
pm2 stop ${PROCESS_NAME}
pm2 delete ${PROCESS_NAME}
pm2 start ./lib/server.js --watch --name="${PROCESS_NAME}"
EOF
