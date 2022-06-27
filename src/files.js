import express from 'express';
import path from 'path';
import fs from 'fs';

/*
 * ルーティング
 */
const init = async function(config) {
  // 上記引数のconfigはで設定。

  const router = express.Router();

  // express.staticの前に置くことでディレクトリの
  // indexを表示できるようにするミドルウェア
  // ただし、下の方にあるloginCheckとpermissionCheckの
  // 後に置かれておりreq.session.uidとかが使える前提で
  // 書かれている
  const dirIndex = async function(req,res,next) {
    const the_path = config.files.root + req.path;
    const stats = await stat(the_path);
    if (!!stats && stats.isDirectory()) { // ここの判定はシンボリックリンクでもOKっぽい
      if (req.accepts(['html', 'json'])==='json') {
        const files = await readdir(the_path);
        res.json({files});
        return;
      } else {
        if (the_path.endsWith('/')) {
          const files = await readdir(the_path);
          files.unshift(parentDir);
          let c_path = path.join(config.server.mount_path,'files/',req.path);
          const baseUrl = config.server.mount_path;
          res.render('files/dir_index', {
            c_path, files, baseUrl,
            admin: req.session.admin,
            teacher: req.session.teacher,
            sa: req.session.sa
          });
          return;
        } else {
          const basename = path.basename(the_path);
          res.redirect('./'+basename+'/');
          return;
        }
      }
    }
    next();
  };
  const staticRouter = express.static(config.files.root);
  const parentDir = {
    name: '..',
    isDirectory: function() { return true; }
  };

  // パスを調べて非同期でStatsを返す。
  async function stat(path) {
    return new Promise((resolve,reject)=>{
      fs.stat(path,(err,stats)=>{
        if (err) {
          resolve(null);
          return;
        }
        resolve(stats);
      });
    });
  }

  // フォルダの中一覧を非同期でゲット
  // シンボリックリンクもリンク先の属性で
  // 取得したいのだが、ただのfs.readdirの
  // withFileTypes:trueではうまくいかなかったので
  // 以下のようにした。
  async function readdir(dir) {
    return new Promise((resolve,reject) => {
      fs.readdir(dir,{},async function(err,dirents) {
        if (err) {
          reject(err);
          return;
        }
        const files = [];
        for (let e of dirents) {
          const f = await stat(path.join(dir,e));
          f.name = e; // 無理矢理追加
          files.push(f);
        }
        resolve(files);
      });
    });
  }

  // ログインチェック AND uid取得
  function loginCheck(req,res,next) {
    let uid = null;
    if (!!req.session && !!req.session.uid)
      uid = req.session.uid;
    if (!uid) {
      const loginURL = config.server.mount_path+'auth/login?return_path='+config.server.mount_path.slice(0,-1)+req.originalUrl;
      res.redirect(loginURL);
      return;
    }
    next();
  }

  // アクセス件チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.uidにuidが入っている前提で処理している。
  async function permissionCheck(req,res,next) {
    const uid = req.session.uid;
    const the_path = path.join(config.files.root,req.path);
    const stats = await fs.promises.stat(the_path);
    let uids_file;
    if (!!stats && stats.isDirectory()) {
      uids_file = path.join(the_path,'.uids');
    } else {
      const parent = path.dirname(the_path);
      uids_file = path.join(parent,'.uids');
    }
    let uids_str;
    try {
      uids_str = await fs.promises.readFile(uids_file);
    } catch(e) {
      res.status(403).render('error.ejs',{
        msg: 'You do not have permission.',
        baseUrl: config.server.mount_path
      });
      return;
    }
      
    const uids = uids_str.toString().split(/\n/);
    for (const u of uids) {
      if (u === uid) {
        next();
        return;
      }
    }
    res.status(403).render('error.ejs',{
      msg: 'You do not have permission.',
      baseUrl: config.server.mount_path
    });
    return;
  }

  router.get('/*',loginCheck,
             permissionCheck,
             dirIndex,
             staticRouter);

  return router;
};

export default init;
