/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URLSearchParams } from 'node:url';
import * as nodemailer from 'nodemailer';
import juice from 'juice';
import { Inject, Injectable } from '@nestjs/common';
import { validate as validateEmail } from 'deep-email-validator';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type Logger from '@/logger.js';
import type { MiMeta, UserProfilesRepository } from '@/models/_.js';
import { LoggerService } from '@/core/LoggerService.js';
import { bindThis } from '@/decorators.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

@Injectable()
export class EmailService {
    private logger: Logger;

    constructor(
        @Inject(DI.config)
        private config: Config,

        @Inject(DI.meta)
        private meta: MiMeta,

        @Inject(DI.userProfilesRepository)
        private userProfilesRepository: UserProfilesRepository,

        private loggerService: LoggerService,
        private utilityService: UtilityService,
        private httpRequestService: HttpRequestService,
    ) {
        this.logger = this.loggerService.getLogger('email');
    }

    @bindThis
    public async sendEmail(to: string, subject: string, html: string, text: string) {
        if (!this.meta.enableEmail) return;

        if (!this.isGmailAddress(to)) {
            throw new Error('Only Gmail addresses are allowed');
        }

        const iconUrl = `${this.config.url}/static-assets/mi-white.png`;
        const emailSettingUrl = `${this.config.url}/settings/email`;

        const enableAuth = this.meta.smtpUser != null && this.meta.smtpUser !== '';

        const transporter = nodemailer.createTransport({
            host: this.meta.smtpHost,
            port: this.meta.smtpPort,
            secure: this.meta.smtpSecure,
            ignoreTLS: !enableAuth,
            proxy: this.config.proxySmtp,
            auth: enableAuth ? {
                user: this.meta.smtpUser,
                pass: this.meta.smtpPass,
            } : undefined,
        } as any);

        const htmlContent = `<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
            html {
                background: #eee;
            }

            body {
                padding: 16px;
                margin: 0;
                font-family: sans-serif;
                font-size: 14px;
            }

            a {
                text-decoration: none;
                color: #86b300;
            }
            a:hover {
                text-decoration: underline;
            }

            main {
                max-width: 500px;
                margin: 0 auto;
                background: #fff;
                color: #555;
            }
                main > header {
                    padding: 32px;
                    background: #86b300;
                }
                    main > header > img {
                        max-width: 128px;
                        max-height: 28px;
                        vertical-align: bottom;
                    }
                main > article {
                    padding: 32px;
                }
                    main > article > h1 {
                        margin: 0 0 1em 0;
                    }
                main > footer {
                    padding: 32px;
                    border-top: solid 1px #eee;
                }

            nav {
                box-sizing: border-box;
                max-width: 500px;
                margin: 16px auto 0 auto;
                padding: 0 32px;
            }
                nav > a {
                    color: #888;
                }
        </style>
    </head>
    <body>
        <main>
            <header>
                <img src="${this.meta.logoImageUrl ?? this.meta.iconUrl ?? iconUrl}"/>
            </header>
            <article>
                <h1>${subject}</h1>
                <div>${html}</div>
            </article>
            <footer>
                <a href="${emailSettingUrl}">${'Email setting'}</a>
            </footer>
        </main>
        <nav>
            <a href="${this.config.url}">${this.config.host}</a>
        </nav>
    </body>
</html>`;

        const inlinedHtml = juice(htmlContent);

        try {
            // TODO: htmlサニタイズ
            const info = await transporter.sendMail({
                from: this.meta.email!,
                to: to,
                subject: subject,
                text: text,
                html: inlinedHtml,
            });

            this.logger.info(`Message sent: ${info.messageId}`);
        } catch (err) {
            this.logger.error(err as Error);
            throw err;
        }
    }

    @bindThis
    public async validateEmailForAccount(emailAddress: string): Promise<{
        available: boolean;
        reason: null | 'used' | 'format' | 'disposable' | 'mx' | 'smtp' | 'banned' | 'network' | 'blacklist' | 'not-gmail';
    }> {
        if (!this.isGmailAddress(emailAddress)) {
            return {
                available: false,
                reason: 'not-gmail',
            };
        }


        return {
            available: true,
            reason: null,
        };
    }

    private isGmailAddress(email: string): boolean {
        return email.toLowerCase().endsWith('@gmail.com');
    }

}
