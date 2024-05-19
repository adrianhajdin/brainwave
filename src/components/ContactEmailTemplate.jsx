export default function ContactEmailTemplate({ message }) {
    const year = new Date().getFullYear();
    const styles = {
        contentContainer: {
            fontFamily: "'Geist', sans-serif",
            display: "block",
            width: "fit-content",
            maxWidth: "600px",
            marginLeft: "auto",
            marginRight: "auto",
            textDecoration: "none",
        },
        infoContainer: {
            fontFamily: "'Geist', sans-serif",
            fontSize: "16px",
            fontWeight: "400",
            textDecoration: "none",
            h3: {
                fontWeight: "600",
                fontSize: "18px",
                color: "#333333",
                textDecoration: "none",
            },
            p: {
                fontSize: "16px",
                display: "block",
                color: "#333333",
                marginBlockStart: "1em",
                marginBlockEnd: "1em",
                marginInlineStart: "0px",
                marginInlineEnd: "0px",
                textDecoration: "none",
            },
            ul: {
                display: "block",
                listStyleType: "disc",
                marginBlockStart: "1em",
                marginBlockEnd: "1em",
                marginInlineStart: "0px",
                marginInlineEnd: "0px",
                paddingInlineStart: "40px",
                textDecoration: "none",
            },
            li: {
                fontSize: "16px",
                marginBottom: "10px",
                color: "#333333",
                textDecoration: "none",
            },
            a: {
                fontWeight: "bold",
                color: "#0070f3",
                textDecoration: "none",
            },
            quotation: {
                fontSize: "14px",
                fontStyle: "italic",
                textAlign: "center",
                marginTop: "20px",
                marginBottom: "20px",
                color: "#555555",
                textDecoration: "none",
            },
        },

        footer: {
            fontFamily: "'Geist', sans-serif",
            display: "block",
            width: "100%",
            paddingTop: "30px",
            header: {
                width: "fit-content",
                marginLeft: "auto",
                marginRight: "auto",
            },
            p: {
                color: "#8c8c8c",
                fontSize: "14px",
                lineHeight: "24px",
                textAlign: "center",
            },
            a: {
                color: "#454545",
                fontWeight: "bold",
                textDecoration: "none",
            },
            img: {
                width: "30px",
                borderTopWidth: "0px",
                borderBottomWidth: "0px",
                borderLeftWidth: "0px",
                borderRightWidth: "0px",
                borderTopStyle: "solid",
                borderBottomStyle: "solid",
                borderLeftStyle: "solid",
                borderRightStyle: "solid",
            },
        },
    };

    return (
        <>
            <div style={styles.contentContainer}>
                <div style={styles.infoContainer}>
                    <h3 style={styles.infoContainer.h3}>Thank you for contacting VideFace!</h3>
                    <p style={styles.infoContainer.p}>
                        We've successfully received your email and we're working on getting back to you as soon as
                        possible. Don't hesitate to reach out to us if you feel that we can help you with anything else.
                        In the meantime, here's some information you might find useful:
                    </p>
                    <ul style={styles.infoContainer.ul}>
                        <li style={styles.infoContainer.li}>
                            <strong>
                                Our team will get back to you within 24 hours, but we usually respond much faster.
                            </strong>{" "}
                            In case you don't hear from us, please check your spam folder or contact us again. There's
                            also a chance that you've contact us in a non-working hour or day, so please be patient.
                        </li>
                        <li style={styles.infoContainer.li}>
                            We're sure you are very curious about our services and how we can help you. We invite you to
                            check out our social media profiles and our website to learn more about us. Here you have
                            our{" "}
                            <a
                                style={styles.infoContainer.a}
                                href="https://linkedin.com/company/videface/"
                                target="_blank"
                            >
                                LinkedIn
                            </a>{" "}
                            and our{" "}
                            <a
                                style={styles.infoContainer.a}
                                href="https://instagram.com/videface.app/"
                                target="_blank"
                            >
                                Instagram
                            </a>{" "}
                            profiles. Take a look at the message we got from you:
                        </li>
                        <p style={styles.infoContainer.quotation}>"{message}"</p>
                    </ul>
                    <p style={styles.infoContainer.p}>
                        We are happy to know you are interested in our services. We are always looking for ways to
                        improve and we are sure that your feedback will help us to do so. We are looking forward to
                        working with you and we hope to hear from you soon.
                    </p>
                    <p style={styles.infoContainer.p}>Best regards,</p>
                </div>
                <footer style={styles.footer}>
                    <div style={styles.footer.header}>
                        <a
                            style={styles.footer.a}
                            href="https://videface.app/"
                            target="_blank"
                            data-saferedirecturl="https://videface.app/"
                            rel="noreferrer nowrapper"
                        >
                            <img style={styles.footer.img} src="https://i.imgur.com/GMVirFc.png" alt="VidefaceLogo" />
                        </a>
                    </div>
                    <p style={styles.footer.p}>
                        <a style={styles.footer.a} href="">
                            VideFace
                        </a>{" "}
                        <br />
                        Feel free to reply to this email if you have any questions or concerns.
                        <br />
                        Copyright © {year} VideFace App. All rights reserved.
                    </p>
                </footer>
            </div>
        </>
    );
}
